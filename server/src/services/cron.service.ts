import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FetcherService } from './fetcher.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly fetcher: FetcherService) {}

  // Run every hour (as per requirements)
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyFeedFetch() {
    const enabled = process.env.CRON_ENABLED !== 'false'; // Default to enabled
    if (!enabled) {
      this.logger.debug('Cron job disabled via CRON_ENABLED env variable');
      return;
    }

    this.logger.log('Starting scheduled feed fetch (hourly)');
    try {
      const result = await this.fetcher.fetchFeeds();
      this.logger.log(`Completed scheduled feed fetch: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error(`Scheduled feed fetch failed: ${(err as any)?.message || String(err)}`);
    }
  }
}
