import { Controller, Get, Query, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('health')
  health() {
    return { status: 'jobs module ok' };
  }

  @Get()
  async list(
    @Query('limit') limit = 20,
    @Query('page') page = 1,
    @Query('q') q?: string,
    @Query('company') company?: string,
    @Query('location') location?: string,
  ) {
    return this.jobsService.list({ q, company, location }, Number(limit), Number(page));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.jobsService.getById(id);
  }
}
