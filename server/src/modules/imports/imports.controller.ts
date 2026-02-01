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
    // Trigger feed fetch and enqueue (all feeds)
    const result = await this.fetcher.fetchFeeds();
    return { message: 'queued', result };
  }

  @Post('start/url')
  async startImportForUrl(@Body() body: StartUrlDto) {
    const url = body?.url;
    const result = await this.fetcher.fetchFeeds(url);
    return { message: 'queued', result };
  }
}
