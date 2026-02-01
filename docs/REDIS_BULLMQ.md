# Redis & BullMQ Queue System

## 🎯 Overview

This document explains how Redis and BullMQ are used to implement a scalable, reliable job queue system for processing feed imports asynchronously.

## 💡 Why Queue System?

### Problems Without Queue

❌ **Synchronous Processing**: User waits for all feeds to fetch  
❌ **No Retry**: Failed jobs lost forever  
❌ **No Scaling**: Can't add more workers  
❌ **Memory Issues**: Processing 1000s of jobs in memory  

### Solutions With Queue

✅ **Async Processing**: User gets immediate response  
✅ **Retry Logic**: Failed jobs retry with exponential backoff  
✅ **Horizontal Scaling**: Add more workers anytime  
✅ **Reliable**: Jobs persisted in Redis  

## 🔧 Technologies

- **Redis**: v6.0+ - In-memory data store
- **BullMQ**: v1.67.0 - Job queue library
- **IORedis**: v5.3.2 - Redis client for Node.js

## 📁 File Structure

```
server/src/services/
├── queue.service.ts           # Producer (adds jobs)
└── fetcher.service.ts         # Uses QueueService

worker/src/
└── worker.ts                  # Consumer (processes jobs)
```

## 🏗️ Architecture

```
┌────────────────┐
│   Frontend     │
└───────┬────────┘
        │ POST /imports/start
        ▼
┌────────────────┐
│  NestJS API    │
│  (Producer)    │
└───────┬────────┘
        │ QueueService.addJob()
        ▼
┌────────────────┐
│  Redis Queue   │ ←──── Persistent Storage
│    (BullMQ)    │
└───────┬────────┘
        │ Worker polls
        ▼
┌────────────────┐
│  Worker        │
│  (Consumer)    │ ←──── Can scale to N workers
└───────┬────────┘
        │ Batch process
        ▼
┌────────────────┐
│   MongoDB      │
└────────────────┘
```

## 💻 Implementation

### 1. Install Dependencies

```bash
# Server
cd server
npm install bullmq ioredis

# Worker
cd worker
npm install bullmq ioredis mongoose
```

### 2. Producer (QueueService)

**File**: `server/src/services/queue.service.ts`

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private connection: IORedis;
  private queue: Queue;
  private dlq: Queue | null = null;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = new IORedis(url);
    const queueName = process.env.BULL_QUEUE_NAME || 'job_import_queue';
    
    // Main queue
    this.queue = new Queue(queueName, { 
      connection: this.connection 
    });
    
    // Dead Letter Queue
    this.dlq = new Queue(`${queueName}_dlq`, { 
      connection: this.connection 
    });
  }

  async addJob(jobId: string, data: any, opts: any = {}) {
    return this.queue.add(jobId, data, {
      jobId,                              // Deterministic ID
      removeOnComplete: true,             // Clean up after success
      attempts: opts.attempts ?? 3,       // Retry 3 times
      backoff: opts.backoff ?? {          // Exponential backoff
        type: 'exponential',
        delay: 1000  // 1s, 2s, 4s
      },
    });
  }

  async addToDLQ(data: any, reason?: string) {
    if (!this.dlq) return null;
    return this.dlq.add(`dlq_${Date.now()}`, { data, reason });
  }

  async onModuleDestroy() {
    await this.queue.close();
    this.connection.disconnect();
  }
}
```

### 3. Consumer (Worker)

**File**: `worker/src/worker.ts`

```typescript
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.BULL_QUEUE_NAME || 'job_import_queue';

const connection = new IORedis(REDIS_URL);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const data = job.data;
    
    // Validate
    if (!data || !data.source || !data.guid) {
      throw new Error('Invalid job data');
    }
    
    // Process job
    pushToBuffer(data);
    
    // Trigger flush if needed
    if (buffer.get(data.source).length >= BATCH_SIZE) {
      await flushBuffers();
    }
  },
  {
    connection,
    concurrency: 10,              // Process 10 jobs simultaneously
    limiter: {
      max: 100,                   // Max 100 jobs
      duration: 1000              // per second
    },
  }
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
  
  // Move to DLQ if max attempts reached
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    await dlqQueue.add(`dlq_${Date.now()}`, {
      jobData: job.data,
      reason: err.message
    });
  }
});
```

## ⚙️ Configuration

### Environment Variables

```env
# Redis Connection
REDIS_URL=redis://localhost:6379
# For Redis Cloud:
# REDIS_URL=redis://:<password>@<host>:<port>

# Queue Name
BULL_QUEUE_NAME=job_import_queue

# Worker Settings
WORKER_CONCURRENCY=10
WORKER_BATCH_SIZE=100
WORKER_FLUSH_MS=3000
WORKER_RATE_LIMIT_MAX=100
WORKER_RATE_LIMIT_DURATION_MS=1000
```

### Redis Configuration

**Local Development**:
```bash
# Install Redis
brew install redis  # macOS
apt install redis   # Ubuntu

# Start Redis
redis-server
```

**Docker**:
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

**Production (Redis Cloud)**:
1. Sign up at https://redis.com/try-free/
2. Create database
3. Get connection URL
4. Set `REDIS_URL` env variable

## 🎮 How It Works

### Job Lifecycle

```
1. Job Creation
   ├─→ Generate deterministic jobId: `${source}#${guid}`
   ├─→ Add to queue with retry config
   └─→ Return immediately to user

2. Queue Storage
   ├─→ Job stored in Redis (persistent)
   ├─→ Status: "waiting"
   └─→ Available for workers

3. Worker Processing
   ├─→ Worker polls queue
   ├─→ Status: "active"
   ├─→ Process job (buffer → batch → MongoDB)
   └─→ Mark complete/failed

4. Retry on Failure
   ├─→ Attempt 1 fails → Wait 1s → Retry
   ├─→ Attempt 2 fails → Wait 2s → Retry
   ├─→ Attempt 3 fails → Wait 4s → Retry
   └─→ Move to DLQ if all fail

5. Cleanup
   ├─→ Success: Remove from queue (removeOnComplete: true)
   └─→ Failure: Move to DLQ
```

### Deterministic Job IDs

```typescript
// Why deterministic IDs?
const jobId = `${source}#${guid}`;
// Example: "https://jobicy.com/?feed=job_feed#12345"

// Benefits:
// 1. Prevents duplicate enqueues
// 2. Same job added twice = only one in queue
// 3. BullMQ automatically deduplicates
```

### Exponential Backoff

```
Attempt 1: Immediate
Attempt 2: Wait 1 second  (2^0 * 1000ms)
Attempt 3: Wait 2 seconds (2^1 * 1000ms)
Attempt 4: Wait 4 seconds (2^2 * 1000ms)

Formula: delay = baseDelay * (2 ^ attemptNumber)
```

## 📊 Queue Operations

### Adding Jobs (Producer)

```typescript
// Single job
await queueService.addJob(
  'feed1#job123',
  { source: 'feed1', guid: 'job123', title: '...' }
);

// Bulk jobs
const jobs = items.map(item => ({
  name: `${source}#${item.guid}`,
  data: item
}));
await queue.addBulk(jobs);
```

### Processing Jobs (Consumer)

```typescript
const worker = new Worker(QUEUE_NAME, async (job) => {
  // job.id - Unique job ID
  // job.data - Job payload
  // job.attemptsMade - Current attempt number
  
  console.log(`Processing: ${job.id}`);
  await processJob(job.data);
  console.log(`Done: ${job.id}`);
});
```

### Monitoring Queue

```typescript
// Get queue stats
const counts = await queue.getJobCounts();
// { waiting: 100, active: 10, completed: 500, failed: 5 }

// Get jobs by state
const waiting = await queue.getWaiting();
const active = await queue.getActive();
const failed = await queue.getFailed();

// Pause/Resume queue
await queue.pause();
await queue.resume();

// Clean old jobs
await queue.clean(3600000, 'completed'); // Remove completed jobs older than 1 hour
```

## 🔒 Best Practices

### 1. Job Data Size

Keep job data small (<1MB):

```typescript
// ❌ BAD - Large data
await queue.add('job1', {
  largeArray: new Array(100000).fill('data')
});

// ✅ GOOD - Reference ID
await queue.add('job1', {
  feedId: 'feed1',
  itemIds: [1, 2, 3]
});
// Worker fetches full data from DB
```

### 2. Idempotent Jobs

Jobs should be safe to retry:

```typescript
// ✅ GOOD - Idempotent (upsert)
await JobModel.updateOne(
  { source, guid },
  { $set: data },
  { upsert: true }
);

// ❌ BAD - Not idempotent (creates duplicates)
await JobModel.create(data);
```

### 3. Job Timeout

```typescript
const worker = new Worker(QUEUE_NAME, processor, {
  connection,
  lockDuration: 30000,  // Job timeout: 30s
});
```

### 4. Error Handling

```typescript
const worker = new Worker(QUEUE_NAME, async (job) => {
  try {
    await processJob(job.data);
  } catch (err) {
    // Log error
    console.error(`Job ${job.id} failed:`, err);
    
    // Throw to trigger retry
    throw err;
  }
});
```

## 🚨 Troubleshooting

### Issue 1: Jobs Stuck in "Active"

**Cause**: Worker crashed without cleanup

**Solution**: Set stalled job check:
```typescript
const worker = new Worker(QUEUE_NAME, processor, {
  stalledInterval: 30000,  // Check every 30s
  maxStalledCount: 2       // Move to failed after 2 checks
});
```

### Issue 2: Memory Leak

**Cause**: Completed jobs not cleaned

**Solution**: Enable auto-cleanup:
```typescript
await queue.add('job', data, {
  removeOnComplete: true,   // Remove on success
  removeOnFail: false       // Keep failures for debugging
});
```

### Issue 3: Redis Connection Errors

**Check**:
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis info
redis-cli info

# Check memory usage
redis-cli info memory
```

### Issue 4: Queue Backlog

**Solution**: Scale workers
```bash
# Docker Compose
docker-compose up --scale worker=5

# Or increase concurrency
WORKER_CONCURRENCY=20
```

## 📈 Monitoring

### BullBoard UI

```bash
npm install @bull-board/express @bull-board/api

# Add to server
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [new BullMQAdapter(queue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access UI: http://localhost:4000/admin/queues

### Metrics

```typescript
import { Counter, Gauge } from 'prom-client';

const jobsProcessed = new Counter({
  name: 'bullmq_jobs_processed_total',
  help: 'Total jobs processed'
});

const queueSize = new Gauge({
  name: 'bullmq_queue_size',
  help: 'Current queue size'
});

// Update metrics
worker.on('completed', () => jobsProcessed.inc());
setInterval(async () => {
  const counts = await queue.getJobCounts();
  queueSize.set(counts.waiting + counts.active);
}, 5000);
```

## 🎯 Performance Optimization

### 1. Connection Pooling

```typescript
// Shared Redis connection
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queue1 = new Queue('queue1', { connection });
const queue2 = new Queue('queue2', { connection });
```

### 2. Batch Processing

```typescript
// Instead of processing one by one
for (const job of jobs) {
  await processJob(job);
}

// Batch process
const BATCH_SIZE = 100;
while (jobs.length) {
  const batch = jobs.splice(0, BATCH_SIZE);
  await processBatch(batch);
}
```

### 3. Rate Limiting

```typescript
const worker = new Worker(QUEUE_NAME, processor, {
  limiter: {
    max: 100,        // Max jobs
    duration: 1000,  // per second
    groupKey: 'source'  // Limit per source
  }
});
```

## ✅ Summary

The Redis & BullMQ implementation provides:
- ✅ **Reliable**: Jobs persisted in Redis
- ✅ **Scalable**: Add workers horizontally
- ✅ **Resilient**: Auto-retry with exponential backoff
- ✅ **Fast**: In-memory queue operations
- ✅ **Observable**: Metrics and monitoring
- ✅ **DLQ Support**: Handle poison messages

---

**Implemented by**: Knovator Job Importer Team  
**Last Updated**: January 2026
