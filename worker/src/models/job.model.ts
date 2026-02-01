import { Schema, model } from 'mongoose';

const JobSchema = new Schema({
  source: { type: String, required: true },
  guid: { type: String, required: true },
  title: String,
  company: String,
  location: String,
  description: String,
  pubDate: Date,
  url: String,
  raw: Schema.Types.Mixed,
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

JobSchema.index({ source: 1, guid: 1 }, { unique: true });

export const JobModel = model('Job', JobSchema);
export default JobModel;
