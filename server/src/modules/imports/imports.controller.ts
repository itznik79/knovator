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
    // Fire-and-forget: Start the process but respond immediately
    this.fetcher.fetchFeeds()
      .then(async (results) => {
        // Save import logs after fetching completes
        for (const result of results) {
          try {
            await this.importsService.createLog({
              fileName: result.fileName,
              totalFetched: result.totalFetched || 0,
              totalImported: result.totalFetched || 0,
              newJobs: result.totalFetched || 0,
              updatedJobs: 0,
              failedJobs: result.error ? 1 : 0,
            });
          } catch (err) {
            console.error('Failed to create import log:', err);
          }
        }
      })
      .catch(err => {
        console.error('Background fetch error:', err);
      });
    
    return { 
      message: 'Import started', 
      status: 'processing',
      timestamp: new Date().toISOString()
    };
  }

  @Post('start/url')
  async startImportForUrl(@Body() body: StartUrlDto) {
    const url = body?.url;
    
    // Fire-and-forget: Start the process but respond immediately
    this.fetcher.fetchFeeds(url)
      .then(async (results) => {
        // Save import logs after fetching completes
        for (const result of results) {
          try {
            await this.importsService.createLog({
              fileName: result.fileName,
              totalFetched: result.totalFetched || 0,
              totalImported: result.totalFetched || 0,
              newJobs: result.totalFetched || 0,
              updatedJobs: 0,
              failedJobs: result.error ? 1 : 0,
            });
          } catch (err) {
            console.error('Failed to create import log:', err);
          }
        }
      })
      .catch(err => {
        console.error('Background fetch error for URL:', url, err);
      });
    
    return { 
      message: 'Import started for URL', 
      url,
      status: 'processing',
      timestamp: new Date().toISOString()
    };
  }
}
