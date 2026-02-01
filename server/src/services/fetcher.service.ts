import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { FEED_URLS } from '../config/feeds';
import { QueueService } from './queue.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  constructor(private readonly queueService: QueueService, private readonly metrics: MetricsService) {}

  async fetchFeeds(singleUrl?: string): Promise<any> {
    const urls = singleUrl ? [singleUrl] : FEED_URLS;
    
    if (!urls || urls.length === 0) {
      this.logger.error('No feed URLs configured');
      return [{ error: 'No feed URLs configured' }];
    }
    
    const summary: any = [];
    for (const url of urls) {
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        this.logger.warn(`Skipping invalid URL: ${url}`);
        summary.push({ fileName: url, error: 'Invalid URL format' });
        continue;
      }
      
      try {
        this.logger.log(`Fetching feed ${url}`);
        const res = await axios.get(url, { 
          responseType: 'text', 
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 300
        });
        
        if (!res.data || typeof res.data !== 'string') {
          throw new Error('Invalid response format');
        }
        
        const xml = res.data;
        this.logger.debug(`Received ${xml.length} bytes from ${url}`);
        
        const parsed = await parseStringPromise(xml, { 
          explicitArray: false, 
          mergeAttrs: true, 
          trim: true,
          strict: false,  // Allow malformed XML
          normalize: true,  // Normalize whitespace
          normalizeTags: true,  // Normalize to lowercase for consistency
          ignoreAttrs: false,  // Keep attributes
        });

        // Locate items for RSS or Atom
        let items: any[] = [];
        if (parsed.rss && parsed.rss.channel) {
          const ch = parsed.rss.channel;
          items = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
        } else if (parsed.feed && parsed.feed.entry) {
          items = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
        }
        
        this.logger.debug(`Found ${items.length} items in ${url}`);

        // Batch process items for better performance
        const jobsToQueue: Array<{ jobId: string; data: any }> = [];
        
        for (const it of items) {
          try {
            const guid = (it.guid && (it.guid._ || it.guid)) || it.id || (it.link && (it.link.href || it.link)) || it.title;
            const link = it.link && (it.link.href || it.link._ || it.link);
            const title = it.title && (typeof it.title === 'object' ? it.title._ || it.title : it.title);
            const description = it.description || it.summary || it.content || null;
            const pubDate = it.pubDate || it.published || it.updated || null;

            const job = {
              source: url,
              guid: String(guid || title || Math.random()),
              title: title || 'No title',
              company: it['job_listing:company'] || it.company || null,
              location: it['job_listing:location'] || it.location || null,
              description,
              pubDate: pubDate ? new Date(pubDate) : undefined,
              url: link || undefined,
              raw: it,
            };

            const jobId = `${url}#${job.guid}`;
            jobsToQueue.push({ jobId, data: job });
          } catch (itemErr) {
            this.logger.warn(`Failed to process item from ${url}: ${(itemErr as any)?.message}`);
          }
        }
        
        // Bulk insert all jobs at once
        let count = 0;
        if (jobsToQueue.length > 0) {
          count = await this.queueService.addJobsBulk(jobsToQueue);
          try { this.metrics.enqueuedCounter.inc(count); } catch (e) {}
        }

        summary.push({ fileName: url, totalFetched: count });
        this.logger.log(`Successfully queued ${count} jobs from ${url}`);
      } catch (err) {
        const errorMsg = (err as any)?.message || String(err);
        this.logger.error(`Failed to fetch ${url}: ${errorMsg}`);
        summary.push({ fileName: url, error: errorMsg });
      }
    }
    return summary;
  }
}
