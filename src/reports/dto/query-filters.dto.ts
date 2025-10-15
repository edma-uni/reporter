import { z } from 'zod';

// Zod schemas for validation
export const EventsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional(),
  funnelStage: z.enum(['top', 'bottom']).optional(),
  eventType: z.string().optional(),
});

export const RevenueQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional(),
  campaignId: z.string().optional(),
});

export const DemographicsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional(),
});

// TypeScript types inferred from schemas
export type EventsQueryDto = z.infer<typeof EventsQuerySchema>;
export type RevenueQueryDto = z.infer<typeof RevenueQuerySchema>;
export type DemographicsQueryDto = z.infer<typeof DemographicsQuerySchema>;
