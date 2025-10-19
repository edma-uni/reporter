import { Controller, Get, Post, Query, UsePipes } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { MaterializedViewsRefreshService } from './services/materialized-views-refresh.service';
import type {
  EventsQueryDto,
  RevenueQueryDto,
  DemographicsQueryDto,
} from './dto/query-filters.dto';
import {
  EventsQuerySchema,
  RevenueQuerySchema,
  DemographicsQuerySchema,
} from './dto/query-filters.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly refreshService: MaterializedViewsRefreshService,
  ) {}

  @Get('events')
  @UsePipes(new ZodValidationPipe(EventsQuerySchema))
  async getEvents(@Query() query: EventsQueryDto) {
    return this.reportsService.getEventStatistics(query);
  }

  @Get('revenue')
  @UsePipes(new ZodValidationPipe(RevenueQuerySchema))
  async getRevenue(@Query() query: RevenueQueryDto) {
    return this.reportsService.getRevenueStatistics(query);
  }

  @Get('demographics')
  @UsePipes(new ZodValidationPipe(DemographicsQuerySchema))
  async getDemographics(@Query() query: DemographicsQueryDto) {
    return this.reportsService.getDemographics(query);
  }

  @Post('refresh-views')
  async refreshMaterializedViews() {
    await this.refreshService.manualRefreshAll();
    return {
      message: 'Materialized views refresh initiated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
