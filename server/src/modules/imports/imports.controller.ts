import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { FetcherService } from '../../services/fetcher.service';
import { StartUrlDto } from './dto/start-url.dto';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService, private readonly fetcher: FetcherService) {}

  @Get()
  async list(
    @Query('limit') limit = 20,
    @Query('page') page = 1,
    @Query('fileName') fileName?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.importsService.list(Number(limit), Number(page), { fileName, from, to });
  }

  @Post()
  async create(@Body() body: any) {
    return this.importsService.createLog(body);
  }

  @Post('start')
  async startImport() {
    this.startImportProcess();
    return { 
      message: 'Import started', 
      status: 'processing',
      timestamp: new Date().toISOString()
    };
  }

  @Get('cron-trigger')
  async cronTrigger() {
    this.startImportProcess();
    return {
      message: 'Cron triggered import started',
      status: 'processing',
      timestamp: new Date().toISOString()
    };
  }

  private startImportProcess() {
    // Fire-and-forget: Start the process but respond immediately
    this.fetcher.fetchFeeds()
      .then(async (results) => {
        console.log(`[ImportsController] Received ${results.length} results from fetchFeeds`);
        // Save import logs after fetching completes
        for (const result of results) {
          try {
            console.log(`[ImportsController] Creating import log for ${result.fileName}`);
            const log = await this.importsService.createLog({
              fileName: result.fileName,
              totalFetched: result.totalFetched || 0,
              totalImported: result.totalFetched || 0,
              newJobs: result.totalFetched || 0,
              updatedJobs: 0,
              failedJobs: result.error ? 1 : 0,
            });
            console.log(`[ImportsController] Created import log:`, log._id);
          } catch (err) {
            console.error('[ImportsController] Failed to create import log:', err);
          }
        }
        console.log(`[ImportsController] Finished creating all import logs`);
      })
      .catch(err => {
        console.error('[ImportsController] Background fetch error:', err);
      });
  }

  @Post('start/url')
  async startImportForUrl(@Body() body: StartUrlDto) {
    const url = body?.url;
    
    // Fire-and-forget: Start the process but respond immediately
    this.fetcher.fetchFeeds(url)
      .then(async (results) => {
        console.log(`[ImportsController] Received ${results.length} results from fetchFeeds for URL: ${url}`);
        // Save import logs after fetching completes
        for (const result of results) {
          try {
            console.log(`[ImportsController] Creating import log for ${result.fileName}`);
            const log = await this.importsService.createLog({
              fileName: result.fileName,
              totalFetched: result.totalFetched || 0,
              totalImported: result.totalFetched || 0,
              newJobs: result.totalFetched || 0,
              updatedJobs: 0,
              failedJobs: result.error ? 1 : 0,
            });
            console.log(`[ImportsController] Created import log:`, log._id);
          } catch (err) {
            console.error('[ImportsController] Failed to create import log:', err);
          }
        }
        console.log(`[ImportsController] Finished creating all import logs for URL`);
      })
      .catch(err => {
        console.error('[ImportsController] Background fetch error for URL:', url, err);
      });
    
    return { 
      message: 'Import started for URL', 
      url,
      status: 'processing',
      timestamp: new Date().toISOString()
    };
  }
}
