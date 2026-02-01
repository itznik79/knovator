import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { JobModel } from './models/job.model';
import { ImportLogModel } from './models/import-log.model';
import client from 'prom-client';
import http from 'http';
import { validateWorkerEnv } from './config/env.validator';

// Validate environment before starting
try {
  validateWorkerEnv();
} catch (err) {
  console.error('Environment validation failed:', err);
  process.exit(1);
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/knovator';
const QUEUE_NAME = process.env.BULL_QUEUE_NAME || 'job_import_queue';
const FLUSH_INTERVAL_MS = Number(process.env.WORKER_FLUSH_MS || 1000); // Faster flush
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE || 500); // Larger batches
const MAX_BUFFER_SIZE = Number(process.env.WORKER_MAX_BUFFER_SIZE || 50000); // Handle more
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 50); // Parallel processing

const logger = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

async function connectMongo() {
  await mongoose.connect(MONGO_URI, { dbName: 'knovator' });
  logger.info('Worker connected to MongoDB');
}

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Buffer incoming jobs grouped by source
const buffer = new Map<string, any[]>();
const stats = new Map<string, { totalFetched: number; newJobs: number; updatedJobs: number; failedJobs: number; failures: any[] }>();

// Expose metrics for worker on WORKER_METRICS_PORT
const workerMetricsPort = Number(process.env.WORKER_METRICS_PORT || 9101);
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });
const workerProcessed = new client.Counter({ name: 'knovator_worker_jobs_processed_total', help: 'worker processed', registers: [registry] });
const workerFailed = new client.Counter({ name: 'knovator_worker_jobs_failed_total', help: 'worker failed', registers: [registry] });

const metricsServer = http.createServer(async (_req, res) => {
  try {
    const result = await registry.metrics();
    res.writeHead(200, { 'Content-Type': registry.contentType });
    res.end(result);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});
metricsServer.listen(workerMetricsPort, () => logger.info(`Worker metrics listening on ${workerMetricsPort}`));

function pushToBuffer(item: any) {
  const src = item.source || 'unknown';
  if (!buffer.has(src)) buffer.set(src, []);
  
  const srcBuffer = buffer.get(src)!;
  
  // Check max buffer size to prevent memory leak
  if (srcBuffer.length >= MAX_BUFFER_SIZE) {
    logger.warn(`Buffer for ${src} reached max size ${MAX_BUFFER_SIZE}, forcing flush`);
    flushBuffers().catch(e => logger.error('Forced flush failed:', e));
  }
  
  srcBuffer.push(item);

  if (!stats.has(src)) {
    stats.set(src, { totalFetched: 0, newJobs: 0, updatedJobs: 0, failedJobs: 0, failures: [] });
  }
  stats.get(src)!.totalFetched += 1;
}

async function flushBuffers() {
  if (buffer.size === 0) return;
  
  const sources = Array.from(buffer.entries());
  for (const [source, items] of sources) {
    if (!items || items.length === 0) {
      buffer.delete(source);
      continue;
    }
    
    // process in chunks
    while (items.length > 0) {
      const chunk = items.splice(0, BATCH_SIZE);
      if (chunk.length === 0) break;
      
      const ops = chunk
        .filter(it => it && it.source && it.guid) // Filter invalid items
        .map((it) => ({
          updateOne: {
            filter: { source: it.source, guid: it.guid },
            update: { $set: { ...it, updatedAt: new Date() } },
            upsert: true,
          },
        }));

      if (ops.length === 0) {
        logger.warn(`No valid items in chunk for ${source}`);
        continue;
      }

      try {
        const res: any = await JobModel.bulkWrite(ops, { ordered: false });
        // determine upserted/new vs modified counts
        const upserted = (res.upsertedCount ?? res.nUpserted) || (res.upserted ? res.upserted.length : 0) || 0;
        const modified = (res.modifiedCount ?? res.nModified) || 0;

        const st = stats.get(source);
        if (st) {
          st.newJobs += upserted;
          st.updatedJobs += modified;
        }
        // metrics: processed
        try { workerProcessed.inc(ops.length); } catch (e) {}
      } catch (err: any) {
        logger.error(`Bulk write error for source ${source}: ${String(err)}`);
        const st = stats.get(source);
        if (st) {
          st.failedJobs += chunk.length;
          st.failures.push({ error: String(err), sample: chunk.slice(0, 3) });
        }
        try { workerFailed.inc(chunk.length); } catch (e) {}
      }
    }

    // After processing all items for this source, persist an import log
    const st = stats.get(source);
    if (st) {
      try {
        await ImportLogModel.create({
          fileName: source,
          totalFetched: st.totalFetched,
          totalImported: st.newJobs + st.updatedJobs,
          newJobs: st.newJobs,
          updatedJobs: st.updatedJobs,
          failedJobs: st.failedJobs,
          failures: st.failures.slice(0, 100), // Limit failures array size
        });
      } catch (err) {
        logger.error(`Failed to write import log for ${source}: ${String(err)}`);
      }
    }

    // clear processed source buffers and stats
    buffer.delete(source);
    stats.delete(source);
  }
}

// periodic flush
const interval = setInterval(() => {
  flushBuffers().catch((e) => logger.error('flushBuffers failed', String(e)));
}, FLUSH_INTERVAL_MS);



const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const data = job.data;
    // Basic validation
    if (!data || typeof data !== 'object') {
      logger.warn(`Skipping invalid job ${String(job?.id)}: invalid data type`);
      return;
    }
    
    if (!data.source || !data.guid) {
      logger.warn(`Skipping invalid job ${String(job?.id)}: missing source or guid`);
      return;
    }
    
    if (typeof data.source !== 'string' || typeof data.guid !== 'string') {
      logger.warn(`Skipping invalid job ${String(job?.id)}: invalid types`);
      return;
    }
    
    pushToBuffer(data);
    // trigger immediate flush if buffer for source exceeds threshold
    const srcBuffer = buffer.get(data.source);
    if (srcBuffer && srcBuffer.length >= BATCH_SIZE) {
      await flushBuffers();
    }
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: Number(process.env.WORKER_RATE_LIMIT_MAX || 1000),
      duration: Number(process.env.WORKER_RATE_LIMIT_DURATION_MS || 1000),
    },
  },
);

// simple DLQ writer
const dlqQueueName = `${QUEUE_NAME}_dlq`;
const dlqQueue = new (require('bullmq').Queue)(dlqQueueName, { connection });

worker.on('completed', (job) => logger.info(`Completed ${job.id}`));
worker.on('failed', async (job, err) => {
  try {
    logger.error(`Failed ${job?.id}: ${String(err)}`);
    // if job has exceeded attempts, move to DLQ
    if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
      await dlqQueue.add(`dlq_${Date.now()}`, { jobData: job.data, reason: String(err) });
      logger.info(`Moved job to DLQ ${job.id}`);
    }
  } catch (e) {
    logger.error(`Failed moving to DLQ: ${String(e)}`);
  }
});

process.on('SIGINT', async () => {
  logger.info('Shutting down worker gracefully...');
  clearInterval(interval);
  
  // Set a timeout for graceful shutdown
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  try {
    logger.info('Flushing remaining buffers...');
    await flushBuffers();
    logger.info('Closing worker...');
    await worker.close();
    logger.info('Disconnecting Redis...');
    connection.disconnect();
    logger.info('Disconnecting MongoDB...');
    await mongoose.disconnect();
    clearTimeout(shutdownTimeout);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (e) {
    logger.error(`Error during shutdown: ${String(e)}`);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
});

// start
connectMongo().catch((err) => {
  logger.error(`Failed connecting to Mongo: ${String(err)}`);
  process.exit(1);
});

