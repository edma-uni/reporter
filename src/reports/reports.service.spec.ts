import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let metrics: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            eventStatistic: {
              count: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            revenueRecord: {
              count: jest.fn(),
              findMany: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            demographicRecord: {
              findMany: jest.fn(),
              groupBy: jest.fn(),
              aggregate: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordReportQueryDuration: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    metrics = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEventStatistics', () => {
    it('should return event statistics with aggregations', async () => {
      const mockEvents = [
        {
          eventId: '1',
          timestamp: new Date(),
          source: 'facebook',
          funnelStage: 'top',
          eventType: 'ad.view',
          userId: 'user1',
          userName: 'Test User',
          userAge: 25,
          userGender: 'male',
          country: 'US',
          city: 'NYC',
          username: null,
          followers: null,
          watchTime: null,
          percentageWatched: null,
        },
      ];

      jest.spyOn(prisma.eventStatistic, 'count').mockResolvedValue(1);
      jest
        .spyOn(prisma.eventStatistic, 'findMany')
        .mockResolvedValue(mockEvents);
      jest.spyOn(prisma.eventStatistic, 'groupBy').mockResolvedValue([
        {
          source: 'facebook',
          funnelStage: 'top',
          eventType: 'ad.view',
          _count: { _all: 1 },
        },
      ]);

      const result = await service.getEventStatistics({});

      expect(result.total).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.aggregated).toHaveLength(1);
      expect(metrics.recordReportQueryDuration).toHaveBeenCalledWith(
        'events',
        expect.any(Number),
      );
    });

    it('should apply filters correctly', async () => {
      jest.spyOn(prisma.eventStatistic, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.eventStatistic, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.eventStatistic, 'groupBy').mockResolvedValue([]);

      await service.getEventStatistics({
        source: 'facebook',
        funnelStage: 'top',
        from: '2024-01-01',
        to: '2024-12-31',
      });

      expect(prisma.eventStatistic.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          source: 'facebook',
          funnelStage: 'top',
          timestamp: expect.any(Object),
        }),
      });
    });
  });

  describe('getRevenueStatistics', () => {
    it('should return revenue statistics', async () => {
      const mockRevenue = [
        {
          eventId: '1',
          timestamp: new Date(),
          source: 'facebook',
          eventType: 'checkout.complete',
          purchaseAmount: 99.99,
          campaignId: 'camp1',
          adId: 'ad1',
          userId: 'user1',
          username: null,
          purchasedItem: null,
        },
      ];

      jest.spyOn(prisma.revenueRecord, 'count').mockResolvedValue(1);
      jest
        .spyOn(prisma.revenueRecord, 'findMany')
        .mockResolvedValue(mockRevenue);
      jest.spyOn(prisma.revenueRecord, 'aggregate').mockResolvedValue({
        _sum: { purchaseAmount: 99.99 },
        _avg: {},
        _count: {},
        _max: {},
        _min: {},
      });
      jest.spyOn(prisma.revenueRecord, 'groupBy').mockResolvedValue([
        {
          source: 'facebook',
          _sum: { purchaseAmount: 99.99 },
          _count: { _all: 1 },
        },
      ]);

      const result = await service.getRevenueStatistics({});

      expect(result.total).toBe(1);
      expect(result.totalRevenue).toBe('99.99');
      expect(result.aggregatedBySource).toHaveLength(1);
      expect(metrics.recordReportQueryDuration).toHaveBeenCalledWith(
        'revenue',
        expect.any(Number),
      );
    });
  });
});
