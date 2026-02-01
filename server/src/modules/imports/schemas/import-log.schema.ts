import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImportLogDocument = ImportLog & Document;

@Schema({ timestamps: true })
export class ImportLog {
  @Prop({ required: true })
  fileName: string;

  @Prop({ default: 0 })
  totalFetched: number;

  @Prop({ default: 0 })
  totalImported: number;

  @Prop({ default: 0 })
  newJobs: number;

  @Prop({ default: 0 })
  updatedJobs: number;

  @Prop({ default: 0 })
  failedJobs: number;

  @Prop({ type: Object })
  failures: any[];
}

export const ImportLogSchema = SchemaFactory.createForClass(ImportLog);
