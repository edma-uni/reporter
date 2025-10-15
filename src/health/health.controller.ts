import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness probe - checks if the application is running
   * Returns 200 if the app is alive, 503 if not
   */
  @Get('live')
  checkLiveness() {
    const isAlive = this.healthService.checkLiveness();
    return {
      status: isAlive ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'reporter',
    };
  }

  /**
   * Readiness probe - checks if the service is ready to accept traffic
   * Returns 200 if ready (DB + NATS connected), 503 if not
   */
  @Get('ready')
  async checkReadiness() {
    const readiness = await this.healthService.checkReadiness();

    if (!readiness.isReady) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'reporter',
        checks: readiness.checks,
      };
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'reporter',
      checks: readiness.checks,
    };
  }
}
