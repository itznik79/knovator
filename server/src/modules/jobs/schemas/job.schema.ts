import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobDocument = Job & Document;

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  guid: string;

  @Prop()
  title: string;

  @Prop()
  company: string;

  @Prop()
  location: string;

  @Prop()
  description: string;

  @Prop()
  pubDate: Date;

  @Prop()
  url: string;

  @Prop({ type: Object })
  raw: any;
}

export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ source: 1, guid: 1 }, { unique: true });
