import { Controller, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable, interval, from, switchMap, map } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImportLog, ImportLogDocument } from '../imports/schemas/import-log.schema';
import IORedis from 'ioredis';

@Controller('progress')
export class ProgressController {
  private redis: IORedis;

  constructor(@InjectModel(ImportLog.name) private importModel: Model<ImportLogDocument>) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  @Sse('stream')
  streamProgress(@Query('sources') sources?: string): Observable<MessageEvent> {
    const queueName = process.env.BULL_QUEUE_NAME || 'job_import_queue';
    
    return interval(1000).pipe(
      switchMap(() => from(this.getProgressData(queueName))),
      map(data => ({ data })),
    );
  }

  private async getProgressData(queueName: string) {
    try {
      // Get queue stats from Redis
      const waiting = await this.redis.llen(`bull:${queueName}:wait`);
      const active = await this.redis.llen(`bull:${queueName}:active`);
      const completed = await this.redis.scard(`bull:${queueName}:completed`);
      const failed = await this.redis.scard(`bull:${queueName}:failed`);
      
      // Get recent import logs (last 5)
      const recentImports = await this.importModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fileName totalFetched totalImported newJobs updatedJobs failedJobs createdAt')
        .lean();

      return {
        queue: {
          waiting,
          active,
          completed,
          failed,
          total: waiting + active,
        },
        recentImports,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: 'Failed to fetch progress',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
