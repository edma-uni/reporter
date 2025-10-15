import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamClient,
  JSONCodec,
  JsMsg,
  ConsumerConfig,
  AckPolicy,
  DeliverPolicy,
  JetStreamManager,
} from 'nats';

export interface MessageHandler {
  (data: unknown, msg: JsMsg): Promise<void>;
}

@Injectable()
export class NatsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsConsumerService.name);
  private nc: NatsConnection;
  private js: JetStreamClient;
  private jsm: JetStreamManager;
  private readonly jsonCodec = JSONCodec();

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      this.nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
        name: `reporter-${process.env.HOSTNAME || 'local'}`,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
        timeout: 10000,
        pingInterval: 20000,
        maxPingOut: 3,
      });

      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();

      this.logger.log(`Connected to NATS server ${this.nc.getServer()}`);

      // Monitor connection status
      (async () => {
        for await (const status of this.nc.status()) {
          this.logger.log(
            `NATS connection status: ${status.type} - ${status.data}`,
          );
        }
      })();
    } catch (error) {
      this.logger.error('Error connecting to NATS server', error);
      throw error;
    }
  }

  /**
   * Subscribe to a NATS JetStream subject and process messages
   * @param subject - The subject pattern to subscribe to (e.g., "processed.events.>")
   * @param handler - Async function to handle each message
   * @param consumerName - Optional consumer name for durable subscription
   */
  async subscribe(
    subject: string,
    handler: MessageHandler,
    consumerName?: string,
  ): Promise<void> {
    // Wait for JetStream to be initialized (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    while (!this.js && Date.now() - startTime < maxWaitTime) {
      this.logger.log('Waiting for JetStream to initialize...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!this.js) {
      throw new Error('JetStream is not initialized');
    }

    try {
      const consumerConfig: Partial<ConsumerConfig> = {
        durable_name:
          consumerName || `reporter-${subject.replace(/[.>]/g, '-')}`,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        ack_wait: 30_000_000_000, // 30 seconds in nanoseconds
        max_deliver: 5, // Retry up to 5 times
        filter_subject: subject,
      };

      // Create or get existing consumer
      const durableName = consumerConfig.durable_name!;
      let consumer;
      try {
        await this.jsm.consumers.info('PROCESSED_EVENTS', durableName);
        this.logger.log(`Consumer ${durableName} already exists`);
        consumer = await this.js.consumers.get('PROCESSED_EVENTS', durableName);
      } catch (error: any) {
        if (error.code === '404') {
          await this.jsm.consumers.add('PROCESSED_EVENTS', consumerConfig);
          this.logger.log(`Consumer ${durableName} created`);
          consumer = await this.js.consumers.get('PROCESSED_EVENTS', durableName);
        } else {
          throw error;
        }
      }

      this.logger.log(
        `Subscribed to subject: ${subject} with consumer: ${consumerConfig.durable_name}`,
      );

      // Start consuming messages
      const messages = await consumer.consume();

      // Process messages in the background
      (async () => {
        for await (const msg of messages) {
          try {
            // Decode the message
            const data = this.jsonCodec.decode(msg.data);

            // Call the handler
            await handler(data, msg);
          } catch (error) {
            this.logger.error(
              `Error processing message from ${msg.subject}`,
              error,
            );
            // Handler should manage acknowledgment
          }
        }
      })();
    } catch (error) {
      this.logger.error(`Failed to subscribe to subject ${subject}`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.drain();
      this.logger.log('NATS connection drained and closed');
    }
  }

  isConnected(): boolean {
    return this.nc && !this.nc.isClosed();
  }

  getConnection(): NatsConnection {
    return this.nc;
  }
}
