import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './prisma/prisma.module';
import { MetricsModule } from './metrics/metrics.module';
import { ReportsModule } from './reports/reports.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'reporter_',
        },
      },
      path: '/metrics',
      defaultLabels: {
        app: 'reporter',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
    PrismaModule,
    MetricsModule,
    ReportsModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
