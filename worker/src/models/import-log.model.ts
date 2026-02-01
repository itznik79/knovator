import { Schema, model } from 'mongoose';

const ImportLogSchema = new Schema({
  fileName: { type: String, required: true },
  totalFetched: { type: Number, default: 0 },
  totalImported: { type: Number, default: 0 },
  newJobs: { type: Number, default: 0 },
  updatedJobs: { type: Number, default: 0 },
  failedJobs: { type: Number, default: 0 },
  failures: { type: Array, default: [] },
}, { timestamps: true });

export const ImportLogModel = model('ImportLog', ImportLogSchema);
export default ImportLogModel;
