import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { JsMsg } from 'nats';
import { NatsConsumerService } from '../nats/nats-consumer.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookEvent, TiktokEvent, Event } from './types';

@Injectable()
export class EventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    private readonly natsConsumer: NatsConsumerService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.subscribeToProcessedEvents();
  }

  private async subscribeToProcessedEvents() {
    const subject = 'processed.events.>';

    this.logger.log(`Subscribing to subject: ${subject}`);

    await this.natsConsumer.subscribe(
      subject,
      this.handleProcessedEvent.bind(this),
      'reporter-processed-events',
    );

    this.logger.log(`Successfully subscribed to ${subject}`);
  }

  private async handleProcessedEvent(data: unknown, msg: JsMsg): Promise<void> {
    const subject = msg.subject;

    this.logger.debug(`Processing message from ${subject}`);

    try {
      const event = data as Event;

      // Transform and store the event based on its source
      if (event.source === 'facebook') {
        await this.processFacebookEvent(event);
      } else if (event.source === 'tiktok') {
        await this.processTiktokEvent(event);
      } else {
        this.logger.warn(`Unknown event source`);
        msg.ack(); // Acknowledge unknown sources to prevent redelivery
        return;
      }

      // Acknowledge the message (successful processing)
      msg.ack();

      this.logger.debug(
        `Successfully processed event ${event.eventId} from ${subject}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Processing error for message from ${subject}: ${errorMessage}`,
        errorStack,
      );

      // DO NOT acknowledge the message - let NATS redeliver it
    }
  }

  private async processFacebookEvent(event: FacebookEvent): Promise<void> {
    const timestamp = new Date(event.timestamp);

    // Store in EventStatistic table
    await this.prisma.eventStatistic.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        eventId: event.eventId,
        timestamp,
        source: event.source,
        funnelStage: event.funnelStage,
        eventType: event.eventType,
        userId: event.data.user.userId,
        userName: event.data.user.name,
        userAge: event.data.user.age,
        userGender: event.data.user.gender,
        country: event.data.user.location.country,
        city: event.data.user.location.city,
      },
    });

    // Store in DemographicRecord table
    await this.prisma.demographicRecord.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        eventId: event.eventId,
        timestamp,
        source: event.source,
        userId: event.data.user.userId,
        userName: event.data.user.name,
        age: event.data.user.age,
        gender: event.data.user.gender,
        country: event.data.user.location.country,
        city: event.data.user.location.city,
      },
    });

    // If it's a revenue event (checkout.complete), store in RevenueRecord
    if (
      event.eventType === 'checkout.complete' &&
      'purchaseAmount' in event.data.engagement
    ) {
      const purchaseAmount = event.data.engagement.purchaseAmount;
      if (purchaseAmount) {
        await this.prisma.revenueRecord.upsert({
          where: { eventId: event.eventId },
          update: {},
          create: {
            eventId: event.eventId,
            timestamp,
            source: event.source,
            eventType: event.eventType,
            purchaseAmount: parseFloat(purchaseAmount),
            campaignId: event.data.engagement.campaignId,
            adId: event.data.engagement.adId,
            userId: event.data.user.userId,
          },
        });
      }
    }
  }

  private async processTiktokEvent(event: TiktokEvent): Promise<void> {
    const timestamp = new Date(event.timestamp);

    // Determine watchTime and percentageWatched
    const watchTime =
      'watchTime' in event.data.engagement
        ? event.data.engagement.watchTime
        : null;
    const percentageWatched =
      'percentageWatched' in event.data.engagement
        ? event.data.engagement.percentageWatched
        : null;

    // Store in EventStatistic table
    await this.prisma.eventStatistic.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        eventId: event.eventId,
        timestamp,
        source: event.source,
        funnelStage: event.funnelStage,
        eventType: event.eventType,
        username: event.data.user.username,
        followers: event.data.user.followers,
        watchTime,
        percentageWatched,
      },
    });

    // Store in DemographicRecord table
    await this.prisma.demographicRecord.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        eventId: event.eventId,
        timestamp,
        source: event.source,
        username: event.data.user.username,
        followers: event.data.user.followers,
      },
    });

    // If it's a revenue event (purchase), store in RevenueRecord
    if (
      event.eventType === 'purchase' &&
      'purchaseAmount' in event.data.engagement
    ) {
      const purchaseAmount = event.data.engagement.purchaseAmount;
      const purchasedItem = event.data.engagement.purchasedItem;

      if (purchaseAmount) {
        await this.prisma.revenueRecord.upsert({
          where: { eventId: event.eventId },
          update: {},
          create: {
            eventId: event.eventId,
            timestamp,
            source: event.source,
            eventType: event.eventType,
            purchaseAmount: parseFloat(purchaseAmount),
            username: event.data.user.username,
            purchasedItem,
          },
        });
      }
    }
  }
}
