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
    
    this.connection = new IORedis(url, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    this.connection.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
    
    this.connection.on('connect', () => {
      console.log('Redis connected successfully');
    });
    
    const queueName = process.env.BULL_QUEUE_NAME || 'job_import_queue';
    this.queue = new Queue(queueName, { connection: this.connection });
    // dead-letter queue
    this.dlq = new Queue(`${queueName}_dlq`, { connection: this.connection });
  }

  async addJob(jobId: string, data: any, opts: any = {}) {
    if (!jobId || !data) {
      throw new Error('Invalid job: jobId and data are required');
    }
    
    if (!data.source || !data.guid) {
      throw new Error('Invalid job data: source and guid are required');
    }
    
    try {
      return await this.queue.add(jobId, data, {
        jobId,
        removeOnComplete: true,
        attempts: opts.attempts ?? 3,
        backoff: opts.backoff ?? { type: 'exponential', delay: 1000 },
      });
    } catch (err) {
      console.error(`Failed to add job ${jobId}:`, err);
      throw err;
    }
  }

  // Bulk add jobs for 10x faster queueing
  async addJobsBulk(jobs: Array<{ jobId: string; data: any }>) {
    if (!jobs || jobs.length === 0) return 0;
    
    try {
      const bulkJobs = jobs.map(({ jobId, data }) => ({
        name: jobId,
        data,
        opts: {
          jobId,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      }));
      
      await this.queue.addBulk(bulkJobs);
      return bulkJobs.length;
    } catch (err) {
      console.error(`Failed to enqueue bulk jobs:`, err);
      throw err;
    }
  }

  async addToDLQ(data: any, reason?: string) {
    if (!this.dlq) return null;
    return this.dlq.add(`dlq_${Date.now()}`, { data, reason }, { removeOnComplete: false });
  }

  async onModuleDestroy() {
    try {
      await this.queue.close();
      if (this.dlq) {
        await this.dlq.close();
      }
    } catch (err) {
      console.error('Error closing queues:', err);
    } finally {
      try {
        this.connection.disconnect();
      } catch (err) {
        console.error('Error disconnecting Redis:', err);
      }
    }
  }
}
