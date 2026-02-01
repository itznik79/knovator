import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportLog, ImportLogSchema } from './schemas/import-log.schema';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { FetcherService } from '../../services/fetcher.service';
import { QueueService } from '../../services/queue.service';
import { MetricsService } from '../../services/metrics.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ImportLog.name, schema: ImportLogSchema }])],
  providers: [ImportsService, FetcherService, QueueService, MetricsService],
  controllers: [ImportsController],
  exports: [ImportsService, FetcherService, QueueService, MetricsService],
})
export class ImportsModule {}
