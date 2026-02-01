import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImportLog, ImportLogDocument } from './schemas/import-log.schema';

@Injectable()
export class ImportsService {
  constructor(@InjectModel(ImportLog.name) private importModel: Model<ImportLogDocument>) {}

  async createLog(payload: Partial<ImportLog>) {
    const doc = new this.importModel(payload);
    return doc.save();
  }

  async list(limit = 20, page = 1, filter: { fileName?: string; from?: string; to?: string } = {}) {
    // Validate pagination params
    limit = Math.min(Math.max(1, limit), 100); // Between 1 and 100
    page = Math.max(1, page); // At least 1
    
    const skip = (page - 1) * limit;
    const query: any = {};
    
    if (filter.fileName) {
      query.fileName = { $regex: filter.fileName, $options: 'i' };
    }
    
    if (filter.from || filter.to) {
      query.createdAt = {};
      if (filter.from) {
        try {
          query.createdAt.$gte = new Date(filter.from);
        } catch (e) {
          // Invalid date, skip filter
        }
      }
      if (filter.to) {
        try {
          query.createdAt.$lte = new Date(filter.to);
        } catch (e) {
          // Invalid date, skip filter
        }
      }
    }

    try {
      const [items, total] = await Promise.all([
        this.importModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        this.importModel.countDocuments(query),
      ]);
      return { items, total, page, limit };
    } catch (err) {
      console.error('Failed to list imports:', err);
      return { items: [], total: 0, page, limit };
    }
  }
}
