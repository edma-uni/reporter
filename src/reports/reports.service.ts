import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  EventsQueryDto,
  RevenueQueryDto,
  DemographicsQueryDto,
} from './dto/query-filters.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async getEventStatistics(query: EventsQueryDto) {
    const startTime = Date.now();

    try {
      const where: Prisma.EventStatisticWhereInput = this.buildWhereClause(
        query.from,
        query.to,
        query.source,
      );

      if (query.funnelStage) where.funnelStage = query.funnelStage;
      if (query.eventType) where.eventType = query.eventType;

      // Use Promise.all for parallel queries but limit data fetch
      const [total, events, aggregated] = await Promise.all([
        this.prisma.eventStatistic.count({ where }),
        this.prisma.eventStatistic.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 100,
          select: {
            eventId: true,
            timestamp: true,
            source: true,
            funnelStage: true,
            eventType: true,
            // Facebook fields
            userId: true,
            userName: true,
            userAge: true,
            userGender: true,
            country: true,
            city: true,
            // TikTok fields
            username: true,
            followers: true,
            watchTime: true,
            percentageWatched: true,
          },
        }),
        this.prisma.eventStatistic.groupBy({
          by: ['source', 'funnelStage', 'eventType'],
          where,
          _count: {
            _all: true,
          },
        }),
      ]);

      return {
        total,
        aggregated: aggregated.map((item) => ({
          source: item.source,
          funnelStage: item.funnelStage,
          eventType: item.eventType,
          count: item._count._all,
        })),
        events: events.map((event) => this.mapEventResponse(event)),
      };
    } catch (error) {
      this.logger.error('Error fetching event statistics', error);
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordReportQueryDuration('events', duration);
    }
  }

  private mapEventResponse(event: any) {
    const base = {
      eventId: event.eventId,
      timestamp: event.timestamp,
      source: event.source,
      funnelStage: event.funnelStage,
      eventType: event.eventType,
    };

    if (event.source === 'facebook') {
      return {
        ...base,
        user: {
          userId: event.userId,
          name: event.userName,
          age: event.userAge,
          gender: event.userGender,
          location: {
            country: event.country,
            city: event.city,
          },
        },
      };
    } else {
      return {
        ...base,
        user: {
          username: event.username,
          followers: event.followers,
        },
        watchTime: event.watchTime,
        percentageWatched: event.percentageWatched?.toString(),
      };
    }
  }

  private buildWhereClause(
    from?: string,
    to?: string,
    source?: string,
  ): Prisma.EventStatisticWhereInput {
    const where: Prisma.EventStatisticWhereInput = {};

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    if (source) where.source = source;

    return where;
  }

  async getRevenueStatistics(query: RevenueQueryDto) {
    const startTime = Date.now();

    try {
      const where: Prisma.RevenueRecordWhereInput = this.buildWhereClause(
        query.from,
        query.to,
        query.source,
      ) as Prisma.RevenueRecordWhereInput;

      if (query.campaignId) where.campaignId = query.campaignId;

      const [total, totalRevenue, records, aggregatedBySource] =
        await Promise.all([
          this.prisma.revenueRecord.count({ where }),
          this.prisma.revenueRecord.aggregate({
            where,
            _sum: {
              purchaseAmount: true,
            },
          }),
          this.prisma.revenueRecord.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 100,
            select: {
              eventId: true,
              timestamp: true,
              source: true,
              eventType: true,
              purchaseAmount: true,
              campaignId: true,
              adId: true,
              userId: true,
              username: true,
              purchasedItem: true,
            },
          }),
          this.prisma.revenueRecord.groupBy({
            by: ['source'],
            where,
            _sum: {
              purchaseAmount: true,
            },
            _count: {
              _all: true,
            },
          }),
        ]);

      return {
        total: total,
        totalRevenue: totalRevenue._sum.purchaseAmount?.toString() || '0',
        aggregatedBySource: aggregatedBySource.map((item) => ({
          source: item.source,
          revenue: item._sum.purchaseAmount?.toString() || '0',
          transactions: item._count._all,
        })),
        recentTransactions: records.map((record) => ({
          eventId: record.eventId,
          timestamp: record.timestamp,
          source: record.source,
          eventType: record.eventType,
          purchaseAmount: record.purchaseAmount.toString(),
          ...(record.source === 'facebook'
            ? {
                campaignId: record.campaignId,
                adId: record.adId,
                userId: record.userId,
              }
            : {
                username: record.username,
                purchasedItem: record.purchasedItem,
              }),
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching revenue statistics', error);
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordReportQueryDuration('revenue', duration);
    }
  }

  async getDemographics(query: DemographicsQueryDto) {
    const startTime = Date.now();

    try {
      const where: Prisma.DemographicRecordWhereInput = {};

      if (query.from || query.to) {
        where.timestamp = {};
        if (query.from) where.timestamp.gte = new Date(query.from);
        if (query.to) where.timestamp.lte = new Date(query.to);
      }

      if (query.source) where.source = query.source;

      const records = await this.prisma.demographicRecord.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      // Separate Facebook and TikTok demographics
      const facebookDemographics = records
        .filter((r) => r.source === 'facebook')
        .map((record) => ({
          eventId: record.eventId,
          timestamp: record.timestamp,
          userId: record.userId,
          userName: record.userName,
          age: record.age,
          gender: record.gender,
          location: {
            country: record.country,
            city: record.city,
          },
        }));

      const tiktokDemographics = records
        .filter((r) => r.source === 'tiktok')
        .map((record) => ({
          eventId: record.eventId,
          timestamp: record.timestamp,
          username: record.username,
          followers: record.followers,
        }));

      // Aggregate Facebook demographics
      const facebookAggregates =
        query.source === 'tiktok'
          ? null
          : {
              byGender: await this.prisma.demographicRecord.groupBy({
                by: ['gender'],
                where: { ...where, source: 'facebook', gender: { not: null } },
                _count: { _all: true },
              }),
              byCountry: await this.prisma.demographicRecord.groupBy({
                by: ['country'],
                where: { ...where, source: 'facebook', country: { not: null } },
                _count: { _all: true },
              }),
              byAgeRange: await this.getAgeRangeAggregates(where),
            };

      // Aggregate TikTok demographics
      const tiktokAggregates =
        query.source === 'facebook'
          ? null
          : {
              averageFollowers: await this.prisma.demographicRecord.aggregate({
                where: { ...where, source: 'tiktok', followers: { not: null } },
                _avg: { followers: true },
              }),
              totalUniqueUsers: await this.prisma.demographicRecord.groupBy({
                by: ['username'],
                where: { ...where, source: 'tiktok', username: { not: null } },
                _count: { _all: true },
              }),
            };

      return {
        facebook:
          query.source === 'tiktok'
            ? null
            : {
                records: facebookDemographics.slice(0, 100),
                aggregates: facebookAggregates
                  ? {
                      byGender: facebookAggregates.byGender.map((g) => ({
                        gender: g.gender,
                        count: g._count._all,
                      })),
                      byCountry: facebookAggregates.byCountry.map((c) => ({
                        country: c.country,
                        count: c._count._all,
                      })),
                      byAgeRange: facebookAggregates.byAgeRange,
                    }
                  : null,
              },
        tiktok:
          query.source === 'facebook'
            ? null
            : {
                records: tiktokDemographics.slice(0, 100),
                aggregates: tiktokAggregates
                  ? {
                      averageFollowers:
                        tiktokAggregates.averageFollowers._avg.followers || 0,
                      totalUniqueUsers:
                        tiktokAggregates.totalUniqueUsers.length,
                    }
                  : null,
              },
      };
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordReportQueryDuration('demographics', duration);
    }
  }

  private async getAgeRangeAggregates(
    baseWhere: Prisma.DemographicRecordWhereInput,
  ) {
    const ageRanges = [
      { label: '18-24', min: 18, max: 24 },
      { label: '25-34', min: 25, max: 34 },
      { label: '35-44', min: 35, max: 44 },
      { label: '45-54', min: 45, max: 54 },
      { label: '55+', min: 55, max: 999 },
    ];

    const results = await Promise.all(
      ageRanges.map(async (range) => {
        const count = await this.prisma.demographicRecord.count({
          where: {
            ...baseWhere,
            source: 'facebook',
            age: {
              gte: range.min,
              lte: range.max,
            },
          },
        });
        return { ageRange: range.label, count };
      }),
    );

    return results;
  }
}
