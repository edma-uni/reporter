import { Module } from '@nestjs/common';
import { EventConsumerService } from './event-consumer.service';
import { NatsConsumerService } from '../nats/nats-consumer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EventConsumerService, NatsConsumerService],
})
export class EventsModule {}
