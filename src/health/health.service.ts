import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsConsumerService } from '../nats/nats-consumer.service';

export interface HealthCheck {
  name: string;
  status: 'up' | 'down';
  message?: string;
}

export interface ReadinessResponse {
  isReady: boolean;
  checks: HealthCheck[];
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly natsConsumer: NatsConsumerService,
  ) {}

  /**
   * Liveness check - just checks if the application is running
   */
  checkLiveness(): boolean {
    return true; // If this code runs, the app is alive
  }

  /**
   * Readiness check - verifies all dependencies are healthy
   */
  async checkReadiness(): Promise<ReadinessResponse> {
    const checks: HealthCheck[] = [];

    // Check database connection
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // Check NATS connection
    const natsCheck = this.checkNats();
    checks.push(natsCheck);

    const isReady = checks.every((check) => check.status === 'up');

    return { isReady, checks };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      // Try to execute a simple query
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'up',
        message: 'Connected to PostgreSQL',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${errorMessage}`);
      return {
        name: 'database',
        status: 'down',
        message: errorMessage,
      };
    }
  }

  private checkNats(): HealthCheck {
    try {
      const isConnected = this.natsConsumer.isConnected();
      if (isConnected) {
        return {
          name: 'nats',
          status: 'up',
          message: 'Connected to NATS',
        };
      } else {
        return {
          name: 'nats',
          status: 'down',
          message: 'Not connected to NATS',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`NATS health check failed: ${errorMessage}`);
      return {
        name: 'nats',
        status: 'down',
        message: errorMessage,
      };
    }
  }
}
