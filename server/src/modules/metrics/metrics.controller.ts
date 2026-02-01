import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from '../../services/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(@Res() res: Response) {
    const body = await this.metricsService.metrics();
    res.setHeader('Content-Type', this.metricsService.registry.contentType || 'text/plain');
    res.send(body);
  }
}
