import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);
  private connection: IORedis;
  private dlq: Queue;
  private mainQueue: Queue;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = new IORedis(url, {
      maxRetriesPerRequest: null, // Required for BullMQ
    });
    const queueName = process.env.BULL_QUEUE_NAME || 'job_import_queue';
    this.dlq = new Queue(`${queueName}_dlq`, { connection: this.connection });
    this.mainQueue = new Queue(queueName, { connection: this.connection });
  }

  async list(limit = 100, start = 0) {
    try {
      const jobs = await this.dlq.getJobs(['waiting', 'delayed', 'failed'], start, start + limit - 1, false);
      return jobs.map((j) => ({ id: j.id, attemptsMade: j.attemptsMade, timestamp: j.timestamp, data: j.data }));
    } catch (err) {
      this.logger.error(`Failed to list DLQ jobs: ${(err as any)?.message}`);
      return [];
    }
  }

  async requeue(id: string) {
    try {
      const job = await this.dlq.getJob(id);
      if (!job) {
        throw new Error('Job not found in DLQ');
      }
      
      const payload = job.data.jobData || job.data;
      if (!payload || !payload.source || !payload.guid) {
        throw new Error('Invalid job data - cannot requeue');
      }
      
      await this.mainQueue.add(`requeued_${Date.now()}_${id}`, payload, { removeOnComplete: true });
      await job.remove();
      this.logger.log(`Requeued DLQ job ${id}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to requeue job ${id}: ${(err as any)?.message}`);
      throw err;
    }
  }

  async remove(id: string) {
    try {
      const job = await this.dlq.getJob(id);
      if (!job) {
        this.logger.warn(`Job ${id} not found in DLQ`);
        return false;
      }
      await job.remove();
      this.logger.log(`Removed DLQ job ${id}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to remove job ${id}: ${(err as any)?.message}`);
      throw err;
    }
  }
}
