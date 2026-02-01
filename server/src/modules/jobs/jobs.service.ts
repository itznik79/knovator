import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument } from './schemas/job.schema';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(@InjectModel(Job.name) private jobModel: Model<JobDocument>) {}

  // Bulk upsert using bulkWrite for performance
  async bulkUpsert(items: Partial<Job>[]) {
    if (!items || items.length === 0) return { inserted: 0, modified: 0 };
    const ops = items.map((it) => ({
      updateOne: {
        filter: { source: it.source, guid: it.guid },
        update: { $set: it },
        upsert: true,
      },
    }));

    const res = await this.jobModel.bulkWrite(ops, { ordered: false });
    this.logger.log(`bulkUpsert result: ${JSON.stringify(res as any)}`);
    return res;
  }

  async list(filter: { q?: string; company?: string; location?: string } = {}, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filter.q) {
      query.$or = [
        { title: { $regex: filter.q, $options: 'i' } },
        { description: { $regex: filter.q, $options: 'i' } },
      ];
    }
    if (filter.company) query.company = { $regex: filter.company, $options: 'i' };
    if (filter.location) query.location = { $regex: filter.location, $options: 'i' };

    const [items, total] = await Promise.all([
      this.jobModel.find(query).sort({ pubDate: -1 }).skip(skip).limit(limit).lean(),
      this.jobModel.countDocuments(query),
    ]);
    return { items, total, page, limit };
  }

  async getById(id: string) {
    return this.jobModel.findById(id).lean();
  }
}
