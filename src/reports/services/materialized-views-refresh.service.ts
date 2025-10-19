import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MaterializedViewsRefreshService {
  private readonly logger = new Logger(MaterializedViewsRefreshService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refresh all materialized views every 5 minutes
   * Using CONCURRENTLY to allow queries during refresh
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshAllViews() {
    this.logger.log('Starting materialized views refresh...');
    const startTime = Date.now();

    try {
      await this.refreshEventsHourly();
      await this.refreshRevenueHourly();
      await this.refreshDemographicsFbDaily();
      await this.refreshDemographicsTiktokDaily();

      const duration = Date.now() - startTime;
      this.logger.log(
        `All materialized views refreshed successfully in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Error refreshing materialized views', error);
      throw error;
    }
  }

  /**
   * Refresh events hourly view
   */
  async refreshEventsHourly() {
    try {
      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY report_events_hourly
      `;
      this.logger.debug('Refreshed report_events_hourly');
    } catch (error) {
      this.logger.error('Error refreshing report_events_hourly', error);
      throw error;
    }
  }

  /**
   * Refresh revenue hourly view
   */
  async refreshRevenueHourly() {
    try {
      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY report_revenue_hourly
      `;
      this.logger.debug('Refreshed report_revenue_hourly');
    } catch (error) {
      this.logger.error('Error refreshing report_revenue_hourly', error);
      throw error;
    }
  }

  /**
   * Refresh Facebook demographics daily view
   */
  async refreshDemographicsFbDaily() {
    try {
      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY report_demographics_fb_daily
      `;
      this.logger.debug('Refreshed report_demographics_fb_daily');
    } catch (error) {
      this.logger.error('Error refreshing report_demographics_fb_daily', error);
      throw error;
    }
  }

  /**
   * Refresh TikTok demographics daily view
   */
  async refreshDemographicsTiktokDaily() {
    try {
      await this.prisma.$executeRaw`
        REFRESH MATERIALIZED VIEW CONCURRENTLY report_demographics_tiktok_daily
      `;
      this.logger.debug('Refreshed report_demographics_tiktok_daily');
    } catch (error) {
      this.logger.error(
        'Error refreshing report_demographics_tiktok_daily',
        error,
      );
      throw error;
    }
  }

  /**
   * Manual trigger for refreshing all views (useful for testing or manual operations)
   */
  async manualRefreshAll() {
    this.logger.log('Manual refresh triggered');
    return this.refreshAllViews();
  }
}
