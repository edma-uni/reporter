import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { MaterializedViewsRepository } from './repositories/materialized-views.repository';
import { MaterializedViewsRefreshService } from './services/materialized-views-refresh.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [PrismaModule, MetricsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    MaterializedViewsRepository,
    MaterializedViewsRefreshService,
  ],
})
export class ReportsModule {}
