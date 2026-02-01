import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { ImportLog, ImportLogSchema } from '../imports/schemas/import-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ImportLog.name, schema: ImportLogSchema }]),
  ],
  controllers: [ProgressController],
})
export class ProgressModule {}
