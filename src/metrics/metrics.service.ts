import { Injectable } from '@nestjs/common';
import { Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly reportQueryDuration: Histogram;

  constructor() {
    // Histogram for report query duration by category
    this.reportQueryDuration = new Histogram({
      name: 'reporter_query_duration_seconds',
      help: 'Time taken to execute report queries by category',
      labelNames: ['report_type'], // 'events', 'revenue', 'demographics'
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });
  }

  recordReportQueryDuration(reportType: string, durationSeconds: number) {
    this.reportQueryDuration.observe(
      { report_type: reportType },
      durationSeconds,
    );
  }

  getRegistry() {
    return register;
  }
}
