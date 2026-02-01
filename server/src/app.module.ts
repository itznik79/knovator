import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './modules/jobs/jobs.module';
import { ImportsModule } from './modules/imports/imports.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { DlqModule } from './modules/admin/dlq.module';
import { ProgressModule } from './modules/progress/progress.module';
import { CronService } from './services/cron.service';
import { FetcherService } from './services/fetcher.service';
import { QueueService } from './services/queue.service';
import { MetricsService } from './services/metrics.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/knovator'),
    ScheduleModule.forRoot(),
    JobsModule,
    ImportsModule,
    MetricsModule,
    DlqModule,
    ProgressModule,
  ],
  providers: [CronService, FetcherService, QueueService, MetricsService],
})
export class AppModule {}
