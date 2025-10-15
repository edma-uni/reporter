import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  EventsQueryDto,
  RevenueQueryDto,
  DemographicsQueryDto,
} from './dto/query-filters.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('events')
  async getEvents(@Query() query: EventsQueryDto) {
    return this.reportsService.getEventStatistics(query);
  }

  @Get('revenue')
  async getRevenue(@Query() query: RevenueQueryDto) {
    return this.reportsService.getRevenueStatistics(query);
  }

  @Get('demographics')
  async getDemographics(@Query() query: DemographicsQueryDto) {
    return this.reportsService.getDemographics(query);
  }
}
