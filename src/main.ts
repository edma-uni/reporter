import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT || 3005;

  app.enableShutdownHooks();

  process.on('SIGTERM', () => {
    void (async () => {
      logger.log('SIGTERM signal received: closing HTTP server');
      await app.close();
      logger.log('HTTP server closed');
    })();
  });

  process.on('SIGINT', () => {
    void (async () => {
      logger.log('SIGINT signal received: closing HTTP server');
      await app.close();
      logger.log('HTTP server closed');
    })();
  });

  await app.listen(port);
  logger.log(`Reporter service is running on port ${port}`);
  logger.log(`Health check: http://localhost:${port}/health/ready`);
  logger.log(`Metrics: http://localhost:${port}/metrics`);
}

void bootstrap();
