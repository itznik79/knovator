# Architecture Documentation

## 📐 System Overview

The Knovator Job Importer is a distributed system designed to handle large-scale job data import from multiple RSS/Atom feeds. The system is built with scalability, reliability, and maintainability as core principles.

### Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KNOVATOR SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│              │     │              │     │              │     │          │
│  Next.js UI  │────▶│  NestJS API  │────▶│    Redis     │────▶│  Worker  │
│              │     │              │     │    Queue     │     │          │
│  - Trigger   │     │  - Fetcher   │     │              │     │  - Batch │
│  - History   │     │  - Queue     │     │  - BullMQ    │     │  - Flush │
│  - DLQ UI    │     │  - Cron      │     │  - DLQ       │     │  - Retry │
│              │     │  - Metrics   │     │              │     │          │
└──────┬───────┘     └──────┬───────┘     └──────────────┘     └────┬─────┘
       │                    │                                        │
       │                    │                                        │
       ▼                    ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           MongoDB Database                                │
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  jobs           │  │  import_logs    │  │  Other          │         │
│  │  - source       │  │  - fileName     │  │  Collections    │         │
│  │  - guid         │  │  - totalFetched │  │                 │         │
│  │  - title        │  │  - newJobs      │  │                 │         │
│  │  - company      │  │  - updatedJobs  │  │                 │         │
│  │  - location     │  │  - failedJobs   │  │                 │         │
│  │  - description  │  │  - failures     │  │                 │         │
│  │  - pubDate      │  │  - createdAt    │  │                 │         │
│  │  - url          │  │                 │  │                 │         │
│  │  INDEX:         │  │  INDEX:         │  │                 │         │
│  │  {source,guid}  │  │  {createdAt}    │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        External Feed Sources                              │
│  • jobicy.com (8 different feeds)                                        │
│  • higheredjobs.com                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. Feed Fetching Flow

```
User Trigger (UI) ──┐
                    │
Cron (Hourly) ──────┼──▶ FetcherService.fetchFeeds()
                    │         │
Manual API Call ────┘         │
                              ▼
                    Parse XML to JSON (xml2js)
                              │
                              ▼
                    For each job item:
                    - Extract guid, title, company, location, etc.
                    - Normalize data structure
                              │
                              ▼
                    QueueService.addJob(jobId, jobData)
                    - jobId = `${source}#${guid}` (deterministic)
                    - Retry: 3 attempts with exponential backoff
                              │
                              ▼
                    Redis Queue (BullMQ)
                    - Job stored with metadata
                    - Unique jobId prevents duplicates
```

### 2. Worker Processing Flow

```
Worker polls Redis Queue
         │
         ▼
Job received ──▶ Validate (source, guid exists)
         │
         ▼
Buffer by source ──▶ Map<source, jobs[]>
         │
         ▼
When buffer reaches BATCH_SIZE or FLUSH_MS elapsed:
         │
         ▼
Chunk into batches of BATCH_SIZE (default: 100)
         │
         ▼
For each batch:
  MongoDB.bulkWrite([
    {
      updateOne: {
        filter: { source, guid },
        update: { $set: jobData },
        upsert: true
      }
    },
    ...
  ], { ordered: false })
         │
         ▼
Track results:
  - upsertedCount → newJobs
  - modifiedCount → updatedJobs
  - errors → failedJobs
         │
         ▼
After all batches for source processed:
  Create ImportLog {
    fileName: source,
    totalFetched,
    totalImported: newJobs + updatedJobs,
    newJobs,
    updatedJobs,
    failedJobs,
    failures: [{ error, sample }]
  }
         │
         ▼
Clear buffer for source
```

### 3. Error Handling Flow

```
Job fails in worker
         │
         ▼
Retry with exponential backoff
  - Attempt 1: immediate
  - Attempt 2: 1s delay
  - Attempt 3: 2s delay
         │
         ▼
If all attempts exhausted
         │
         ▼
Move to Dead Letter Queue (DLQ)
  - Store original job data
  - Store error reason
  - Timestamp
         │
         ▼
Admin can:
  - View in DLQ UI
  - Requeue for retry
  - Delete permanently
```

## 🏗️ Design Rationale

### Why BullMQ?

- ✅ **TypeScript Native**: Better type safety than Bull
- ✅ **Better Performance**: Up to 2x faster than Bull
- ✅ **Modern API**: Cleaner async/await patterns
- ✅ **Active Development**: More actively maintained

### Why Batch Processing?

**Without Batching** (1000 jobs):
- 1000 MongoDB connections
- 1000 round trips
- ~10 seconds processing time

**With Batching** (batch size 100):
- 10 MongoDB connections
- 10 round trips
- ~1 second processing time

**Performance Improvement**: 10x faster

### Why `ordered: false` in bulkWrite?

```javascript
// ordered: true (default)
bulkWrite([op1, op2, op3, op4, op5])
// If op2 fails, op3-op5 are NOT executed

// ordered: false
bulkWrite([op1, op2, op3, op4, op5], { ordered: false })
// If op2 fails, op3-op5 are STILL executed
// Result: { ok: 4, errors: [op2] }
```

**Benefit**: Partial failures don't stop entire batch

### Why Compound Unique Index `{source, guid}`?

- **Deduplication**: Prevents duplicate jobs from same source
- **Upsert Performance**: Index used for efficient lookups during upsert
- **Query Performance**: Fast queries like `{ source: 'url' }`

### Why Separate `import_logs` Collection?

**Alternative Design**: Store stats in `jobs` collection
```javascript
// ❌ BAD: Denormalized, complex queries
{
  _id: '...',
  source: 'feed1',
  jobs: [...],
  stats: { newJobs: 10, ... }
}
```

**Current Design**: Separate collection
```javascript
// ✅ GOOD: Normalized, simple queries
// jobs collection: just job data
// import_logs collection: just import stats
```

**Benefits**:
- Cleaner schema separation
- Faster queries on import history
- Can delete old logs without affecting jobs
- Can query stats independently

### Why Deterministic Job IDs?

```javascript
// jobId = `${source}#${guid}`
// Example: "https://jobicy.com/?feed=job_feed#12345"
```

**Benefit**: BullMQ automatically deduplicates based on jobId
- If same job enqueued twice, only one is added
- Prevents queue bloat
- Ensures idempotency

## 📊 Scalability & Performance

### Current Capacity

| Metric | Value |
|--------|-------|
| **Jobs/Second** | ~500-1000 (single worker) |
| **Daily Jobs** | ~40-80 million (single worker) |
| **Worker Concurrency** | 10 (configurable) |
| **Batch Size** | 100 (configurable) |
| **Flush Interval** | 3 seconds |

### Scaling Strategies

#### 1. Horizontal Worker Scaling

```bash
# Deploy multiple worker instances
docker-compose up --scale worker=10
```

**Impact**: 10x throughput (5000-10000 jobs/sec)

#### 2. Increase Batch Size

```env
WORKER_BATCH_SIZE=500
```

**Impact**: 
- Fewer MongoDB round trips
- Higher throughput
- Slight increase in memory usage

#### 3. Database Sharding

For **50M+ jobs**, shard MongoDB by:

**Option A: Shard by `source`**
```javascript
sh.shardCollection("knovator.jobs", { source: 1, guid: 1 })
```

**Option B: Shard by `company`**
```javascript
sh.shardCollection("knovator.jobs", { company: 1, _id: 1 })
```

#### 4. Redis Cluster

For **high availability**, use Redis Cluster:
```env
REDIS_URL=redis://cluster-node1:6379,cluster-node2:6379
```

### Performance Tuning

#### For Maximum Throughput

```env
# Worker settings
WORKER_BATCH_SIZE=1000
WORKER_FLUSH_MS=5000
WORKER_CONCURRENCY=20
WORKER_RATE_LIMIT_MAX=500
WORKER_RATE_LIMIT_DURATION_MS=1000

# Queue settings
BULL_QUEUE_NAME=job_import_queue
```

#### For Low Latency

```env
# Worker settings
WORKER_BATCH_SIZE=50
WORKER_FLUSH_MS=1000
WORKER_CONCURRENCY=5
```

## 🛡️ Reliability & Failure Handling

### Retry Strategy

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000  // 1s, 2s, 4s
  }
}
```

**Handles**:
- Network timeouts
- Temporary MongoDB unavailability
- Rate limit errors

### Dead Letter Queue (DLQ)

Jobs moved to DLQ when:
- All retry attempts exhausted
- Validation fails permanently
- Unknown errors

**DLQ Management**:
- View failed jobs in UI
- Requeue with fixes
- Analyze error patterns
- Delete permanently

### Graceful Shutdown

```javascript
process.on('SIGINT', async () => {
  await flushBuffers();  // Persist buffered jobs
  await worker.close();  // Stop accepting new jobs
  await mongoose.disconnect();
  process.exit(0);
});
```

**Ensures**:
- No data loss on shutdown
- All buffered jobs persisted
- Clean resource cleanup

## 🔍 Observability

### Metrics Exposed

**Server Metrics** (`:4000/metrics`):
- `knovator_jobs_enqueued_total`: Total jobs enqueued
- `knovator_http_requests_total`: HTTP request count
- `knovator_http_request_duration_seconds`: Request latency

**Worker Metrics** (`:9101/metrics`):
- `knovator_worker_jobs_processed_total`: Jobs processed
- `knovator_worker_jobs_failed_total`: Jobs failed
- `process_cpu_seconds_total`: CPU usage
- `nodejs_heap_size_total_bytes`: Memory usage

### Logging Strategy

```typescript
// Structured logging
logger.log(`Fetching feed ${url}`);
logger.error(`Failed to fetch ${url}: ${error.message}`);
logger.info(`Completed batch write: ${upserted} new, ${modified} updated`);
```

**Log Levels**:
- `INFO`: Normal operations
- `WARN`: Recoverable errors
- `ERROR`: Failed operations

## 🎯 Design Patterns Used

### 1. Producer-Consumer Pattern

- **Producer**: FetcherService
- **Queue**: Redis/BullMQ
- **Consumer**: Worker

### 2. Batch Processing Pattern

- Buffer jobs by source
- Flush on threshold or timeout
- Bulk operations for efficiency

### 3. Retry Pattern

- Exponential backoff
- Maximum attempts
- Dead letter queue for poison messages

### 4. Service Layer Pattern

- Business logic in services
- Controllers handle HTTP
- Clean separation of concerns

### 5. Repository Pattern

- Mongoose models abstract database
- Centralized data access
- Easy to swap implementations

## 🔐 Security Considerations

### 1. Input Validation

```typescript
// DTO validation with class-validator
export class StartUrlDto {
  @IsUrl()
  url: string;
}
```

### 2. Rate Limiting

- Worker rate limits prevent overwhelming downstream
- Configurable max requests per duration

### 3. Error Handling

- Never expose internal errors to clients
- Sanitize error messages
- Log full errors server-side

## 📈 Monitoring Recommendations

### Production Setup

1. **Prometheus + Grafana**
   - Scrape metrics from `/metrics` endpoints
   - Create dashboards for:
     - Queue size over time
     - Jobs processed/failed rate
     - Worker CPU/memory usage
     - MongoDB write latency

2. **Alerts**
   - Queue backlog > 10,000 jobs
   - Worker failure rate > 5%
   - DLQ size > 100 jobs
   - MongoDB write latency > 100ms

3. **Logging**
   - Centralized logging (ELK, Datadog)
   - Log sampling for high-volume events
   - Error tracking (Sentry)

## 🚀 Deployment Architecture

### Development
```
Docker Compose
├── MongoDB (local)
├── Redis (local)
├── Server
├── Worker
└── Client
```

### Production
```
Cloud Infrastructure
├── MongoDB Atlas (managed)
├── Redis Cloud (managed)
├── Kubernetes Cluster
│   ├── Server Pod (3 replicas)
│   ├── Worker Pod (10 replicas)
│   └── Ingress
└── Vercel (Next.js)
```

## 🎓 Operational Runbook

### Checking System Health

```bash
# Check queue size
curl http://localhost:4000/metrics | grep queue_size

# Check worker status
curl http://localhost:9101/metrics | grep worker_jobs

# Check import logs
curl http://localhost:4000/imports?limit=10
```

### Handling Queue Backlog

1. Check current queue size in Redis
2. Scale workers: `kubectl scale deployment worker --replicas=20`
3. Monitor throughput improvement
4. Scale down when queue cleared

### Investigating Failed Jobs

1. Check DLQ: `curl http://localhost:4000/admin/dlq`
2. Analyze error patterns
3. Fix root cause (validation, data format, etc.)
4. Requeue jobs: `POST /admin/dlq/requeue/:id`

### Performance Issues

1. Check metrics for bottlenecks
2. Common causes:
   - MongoDB slow queries → Add indexes
   - High queue latency → Scale workers
   - Memory leaks → Restart workers
   - Network issues → Check Redis/MongoDB connectivity

## 📚 Further Reading

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [MongoDB Best Practices](https://www.mongodb.com/docs/manual/administration/production-notes/)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Last Updated**: January 2026

