import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { DlqService } from './dlq.service';

@Controller('admin/dlq')
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  async list(@Query('limit') limit = '100', @Query('start') start = '0') {
    return this.dlq.list(Number(limit), Number(start));
  }

  @Post('requeue/:id')
  async requeue(@Param('id') id: string) {
    await this.dlq.requeue(id);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.dlq.remove(id);
    return { ok: true };
  }
}
