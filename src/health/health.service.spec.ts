import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { NatsConsumerService } from '../nats/nats-consumer.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: PrismaService;
  let natsConsumer: NatsConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: NatsConsumerService,
          useValue: {
            isConnected: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get<PrismaService>(PrismaService);
    natsConsumer = module.get<NatsConsumerService>(NatsConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkLiveness', () => {
    it('should return true', () => {
      const result = service.checkLiveness();
      expect(result).toBe(true);
    });
  });

  describe('checkReadiness', () => {
    it('should return ready when all dependencies are healthy', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      jest.spyOn(natsConsumer, 'isConnected').mockReturnValue(true);

      const result = await service.checkReadiness();

      expect(result.isReady).toBe(true);
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe('up');
      expect(result.checks[1].status).toBe('up');
    });

    it('should return not ready when database is down', async () => {
      jest
        .spyOn(prisma, '$queryRaw')
        .mockRejectedValue(new Error('Connection failed'));
      jest.spyOn(natsConsumer, 'isConnected').mockReturnValue(true);

      const result = await service.checkReadiness();

      expect(result.isReady).toBe(false);
      expect(result.checks[0].status).toBe('down');
    });

    it('should return not ready when NATS is down', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      jest.spyOn(natsConsumer, 'isConnected').mockReturnValue(false);

      const result = await service.checkReadiness();

      expect(result.isReady).toBe(false);
      expect(result.checks[1].status).toBe('down');
    });
  });
});
