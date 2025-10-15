import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NatsConsumerService } from '../nats/nats-consumer.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService, NatsConsumerService],
})
export class HealthModule {}
