import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface EventsHourlyRow {
  hour: Date;
  source: string;
  funnelStage: string;
  eventType: string;
  event_count: bigint;
}

interface RevenueHourlyRow {
  hour: Date;
  source: string;
  campaign_id: string | null;
  total_revenue: Prisma.Decimal;
  transaction_count: bigint;
}

interface DemographicsFbDailyRow {
  day: Date;
  eventType: string;
  gender: string;
  age: number;
  country: string;
  city: string;
  unique_users: bigint;
  event_count: bigint;
}

interface DemographicsTiktokDailyRow {
  day: Date;
  eventType: string;
  country: string;
  follower_segment: string;
  unique_users: bigint;
  event_count: bigint;
}

interface EventsHourlyFilters {
  fromHour?: Date;
  toHour?: Date;
  source?: string;
  funnelStage?: string;
  eventType?: string;
}

interface RevenueHourlyFilters {
  fromHour?: Date;
  toHour?: Date;
  source?: string;
  campaignId?: string;
}

interface DemographicsDailyFilters {
  fromDay?: Date;
  toDay?: Date;
}

@Injectable()
export class MaterializedViewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEventsHourly(
    filters: EventsHourlyFilters,
    limit = 100,
  ): Promise<EventsHourlyRow[]> {
    const conditions: Prisma.Sql[] = [];

    if (filters.fromHour) {
      conditions.push(Prisma.sql`hour >= ${filters.fromHour}`);
    }
    if (filters.toHour) {
      conditions.push(Prisma.sql`hour <= ${filters.toHour}`);
    }
    if (filters.source) {
      conditions.push(Prisma.sql`source = ${filters.source}`);
    }
    if (filters.funnelStage) {
      conditions.push(Prisma.sql`"funnelStage" = ${filters.funnelStage}`);
    }
    if (filters.eventType) {
      conditions.push(Prisma.sql`"eventType" = ${filters.eventType}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql` WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    return this.prisma.$queryRaw<EventsHourlyRow[]>`
      SELECT * FROM report_events_hourly
      ${whereClause}
      ORDER BY hour DESC
      LIMIT ${limit}
    `;
  }

  async findRevenueHourly(
    filters: RevenueHourlyFilters,
    limit = 100,
  ): Promise<RevenueHourlyRow[]> {
    const conditions: Prisma.Sql[] = [];

    if (filters.fromHour) {
      conditions.push(Prisma.sql`hour >= ${filters.fromHour}`);
    }
    if (filters.toHour) {
      conditions.push(Prisma.sql`hour <= ${filters.toHour}`);
    }
    if (filters.source) {
      conditions.push(Prisma.sql`source = ${filters.source}`);
    }
    if (filters.campaignId) {
      conditions.push(Prisma.sql`campaign_id = ${filters.campaignId}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql` WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    return this.prisma.$queryRaw<RevenueHourlyRow[]>`
      SELECT * FROM report_revenue_hourly
      ${whereClause}
      ORDER BY hour DESC
      LIMIT ${limit}
    `;
  }

  async findDemographicsFbDaily(
    filters: DemographicsDailyFilters,
    limit = 100,
  ): Promise<DemographicsFbDailyRow[]> {
    const conditions: Prisma.Sql[] = [];

    if (filters.fromDay) {
      conditions.push(Prisma.sql`day >= ${filters.fromDay}`);
    }
    if (filters.toDay) {
      conditions.push(Prisma.sql`day <= ${filters.toDay}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql` WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    return this.prisma.$queryRaw<DemographicsFbDailyRow[]>`
      SELECT * FROM report_demographics_fb_daily
      ${whereClause}
      ORDER BY day DESC
      LIMIT ${limit}
    `;
  }

  async findDemographicsTiktokDaily(
    filters: DemographicsDailyFilters,
    limit = 100,
  ): Promise<DemographicsTiktokDailyRow[]> {
    const conditions: Prisma.Sql[] = [];

    if (filters.fromDay) {
      conditions.push(Prisma.sql`day >= ${filters.fromDay}`);
    }
    if (filters.toDay) {
      conditions.push(Prisma.sql`day <= ${filters.toDay}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql` WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    return this.prisma.$queryRaw<DemographicsTiktokDailyRow[]>`
      SELECT * FROM report_demographics_tiktok_daily
      ${whereClause}
      ORDER BY day DESC
      LIMIT ${limit}
    `;
  }
}
