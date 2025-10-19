import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { MaterializedViewsRepository } from './repositories/materialized-views.repository';
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
    private readonly viewsRepo: MaterializedViewsRepository,
  ) {}

  async getEventStatistics(query: EventsQueryDto) {
    const startTime = Date.now();

    try {
      const events = await this.viewsRepo.findEventsHourly({
        fromHour: query.from ? new Date(query.from) : undefined,
        toHour: query.to ? new Date(query.to) : undefined,
        source: query.source,
        funnelStage: query.funnelStage,
        eventType: query.eventType,
      });

      // Calculate total event count
      const totalCount = events.reduce(
        (sum, event) => sum + Number(event.event_count || 0),
        0,
      );

      // Group by source, funnelStage, eventType for aggregation
      const aggregatedMap = new Map<string, number>();
      events.forEach((event) => {
        const key = `${event.source}|${event.funnelStage}|${event.eventType}`;
        const current = aggregatedMap.get(key) || 0;
        aggregatedMap.set(key, current + Number(event.event_count || 0));
      });

      const aggregated = Array.from(aggregatedMap.entries()).map(
        ([key, count]) => {
          const [source, funnelStage, eventType] = key.split('|');
          return { source, funnelStage, eventType, count };
        },
      );

      return {
        total: totalCount,
        aggregated,
        hourlyData: events.map((event) => ({
          hour: event.hour,
          source: event.source,
          funnelStage: event.funnelStage,
          eventType: event.eventType,
          count: Number(event.event_count || 0),
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching event statistics', error);
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordReportQueryDuration('events', duration);
    }
  }

  async getRevenueStatistics(query: RevenueQueryDto) {
    const startTime = Date.now();

    try {
      const records = await this.viewsRepo.findRevenueHourly({
        fromHour: query.from ? new Date(query.from) : undefined,
        toHour: query.to ? new Date(query.to) : undefined,
        source: query.source,
        campaignId: query.campaignId,
      });

      // Calculate totals
      const totalRevenue = records.reduce(
        (sum, record) => sum + Number(record.total_revenue || 0),
        0,
      );
      const totalTransactions = records.reduce(
        (sum, record) => sum + Number(record.transaction_count || 0),
        0,
      );

      // Group by source
      const sourceMap = new Map<
        string,
        { revenue: number; transactions: number }
      >();
      records.forEach((record) => {
        const current = sourceMap.get(record.source || '') || {
          revenue: 0,
          transactions: 0,
        };
        sourceMap.set(record.source || '', {
          revenue: current.revenue + Number(record.total_revenue || 0),
          transactions:
            current.transactions + Number(record.transaction_count || 0),
        });
      });

      const aggregatedBySource = Array.from(sourceMap.entries()).map(
        ([source, data]) => ({
          source,
          revenue: data.revenue.toString(),
          transactions: data.transactions,
        }),
      );

      return {
        total: totalTransactions,
        totalRevenue: totalRevenue.toString(),
        aggregatedBySource,
        hourlyData: records.map((record) => ({
          hour: record.hour,
          source: record.source,
          campaignId: record.campaign_id,
          revenue: record.total_revenue?.toString() || '0',
          transactions: Number(record.transaction_count || 0),
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
      let facebookData: any = null;
      let tiktokData: any = null;

      // Query Facebook demographics
      if (query.source !== 'tiktok') {
        const fbRecords = await this.viewsRepo.findDemographicsFbDaily({
          fromDay: query.from ? new Date(query.from) : undefined,
          toDay: query.to ? new Date(query.to) : undefined,
        });

        // Aggregate by gender
        const genderMap = new Map<string, number>();
        fbRecords.forEach((record) => {
          if (record.gender) {
            const current = genderMap.get(record.gender) || 0;
            genderMap.set(
              record.gender,
              current + Number(record.unique_users || 0),
            );
          }
        });

        // Aggregate by country
        const countryMap = new Map<string, number>();
        fbRecords.forEach((record) => {
          if (record.country) {
            const current = countryMap.get(record.country) || 0;
            countryMap.set(
              record.country,
              current + Number(record.unique_users || 0),
            );
          }
        });

        // Aggregate by age range
        const ageRanges = [
          { label: '18-24', min: 18, max: 24 },
          { label: '25-34', min: 25, max: 34 },
          { label: '35-44', min: 35, max: 44 },
          { label: '45-54', min: 45, max: 54 },
          { label: '55+', min: 55, max: 999 },
        ];

        const ageRangeAgg = ageRanges.map((range) => {
          const count = fbRecords
            .filter(
              (r) =>
                r.age !== null &&
                r.age >= range.min &&
                r.age <= range.max,
            )
            .reduce((sum, r) => sum + Number(r.unique_users || 0), 0);
          return { ageRange: range.label, count };
        });

        facebookData = {
          dailyData: fbRecords.map((record) => ({
            day: record.day,
            eventType: record.eventType,
            gender: record.gender,
            age: record.age,
            country: record.country,
            city: record.city,
            uniqueUsers: Number(record.unique_users || 0),
            eventCount: Number(record.event_count || 0),
          })),
          aggregates: {
            byGender: Array.from(genderMap.entries()).map(
              ([gender, count]) => ({ gender, count }),
            ),
            byCountry: Array.from(countryMap.entries()).map(
              ([country, count]) => ({ country, count }),
            ),
            byAgeRange: ageRangeAgg,
          },
        };
      }

      // Query TikTok demographics
      if (query.source !== 'facebook') {
        const tiktokRecords = await this.viewsRepo.findDemographicsTiktokDaily({
          fromDay: query.from ? new Date(query.from) : undefined,
          toDay: query.to ? new Date(query.to) : undefined,
        });

        const totalUniqueUsers = tiktokRecords.reduce(
          (sum, r) => sum + Number(r.unique_users || 0),
          0,
        );

        // Aggregate by country
        const countryMap = new Map<string, number>();
        tiktokRecords.forEach((record) => {
          if (record.country) {
            const current = countryMap.get(record.country) || 0;
            countryMap.set(
              record.country,
              current + Number(record.unique_users || 0),
            );
          }
        });

        // Aggregate by follower segment
        const followerMap = new Map<string, number>();
        tiktokRecords.forEach((record) => {
          if (record.follower_segment) {
            const current = followerMap.get(record.follower_segment) || 0;
            followerMap.set(
              record.follower_segment,
              current + Number(record.unique_users || 0),
            );
          }
        });

        tiktokData = {
          dailyData: tiktokRecords.map((record) => ({
            day: record.day,
            eventType: record.eventType,
            country: record.country,
            followerSegment: record.follower_segment,
            uniqueUsers: Number(record.unique_users || 0),
            eventCount: Number(record.event_count || 0),
          })),
          aggregates: {
            totalUniqueUsers,
            byCountry: Array.from(countryMap.entries()).map(
              ([country, count]) => ({ country, count }),
            ),
            byFollowerSegment: Array.from(followerMap.entries()).map(
              ([segment, count]) => ({ followerSegment: segment, count }),
            ),
          },
        };
      }

      return {
        facebook: facebookData,
        tiktok: tiktokData,
      };
    } catch (error) {
      this.logger.error('Error fetching demographics', error);
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordReportQueryDuration('demographics', duration);
    }
  }
}
