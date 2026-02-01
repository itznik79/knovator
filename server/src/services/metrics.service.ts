import { Injectable } from '@nestjs/common';
import client, { Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  public registry: Registry;
  public enqueuedCounter: client.Counter<string>;
  public processedCounter: client.Counter<string>;
  public failedCounter: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });

    this.enqueuedCounter = new client.Counter({
      name: 'knovator_jobs_enqueued_total',
      help: 'Total jobs enqueued',
      registers: [this.registry],
    });

    this.processedCounter = new client.Counter({
      name: 'knovator_jobs_processed_total',
      help: 'Total jobs processed',
      registers: [this.registry],
    });

    this.failedCounter = new client.Counter({
      name: 'knovator_jobs_failed_total',
      help: 'Total jobs failed',
      registers: [this.registry],
    });
  }

  async metrics() {
    return this.registry.metrics();
  }
}
