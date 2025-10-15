export class EventsQueryDto {
  from?: string; // ISO 8601 date string
  to?: string;
  source?: 'facebook' | 'tiktok';
  funnelStage?: 'top' | 'bottom';
  eventType?: string;
}

export class RevenueQueryDto {
  from?: string;
  to?: string;
  source?: 'facebook' | 'tiktok';
  campaignId?: string;
}

export class DemographicsQueryDto {
  from?: string;
  to?: string;
  source?: 'facebook' | 'tiktok';
}
