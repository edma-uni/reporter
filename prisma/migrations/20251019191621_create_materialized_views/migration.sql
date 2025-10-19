-- -----------------------------------------------------
-- View 1: /reports/events
-- Aggregates basic event counts by hour, source, and type.
-- -----------------------------------------------------

CREATE MATERIALIZED VIEW report_events_hourly AS
SELECT
  date_trunc('hour', timestamp) AS hour,
  'facebook' AS source,
  "funnelStage",
  "eventType",
  COUNT(*) AS event_count
FROM fb_collector."FacebookEvent"
GROUP BY 1, 2, 3, 4
UNION ALL
SELECT
  date_trunc('hour', timestamp) AS hour,
  'tiktok' AS source,
  "funnelStage",
  "eventType",
  COUNT(*) AS event_count
FROM ttk_collector."TiktokEvent"
GROUP BY 1, 2, 3, 4;

-- Index for concurrent refresh and fast filtering
CREATE UNIQUE INDEX idx_report_events_hourly_unique ON report_events_hourly (hour, source, "funnelStage", "eventType");

-- -----------------------------------------------------
-- View 2: /reports/revenue
-- Aggregates revenue data, extracting campaign and purchase amounts.
-- -----------------------------------------------------
CREATE MATERIALIZED VIEW report_revenue_hourly AS
SELECT
  date_trunc('hour', timestamp) AS hour,
  'facebook' AS source,
  data->'engagement'->>'campaignId' AS campaign_id,
  SUM((data->'engagement'->>'purchaseAmount')::numeric) AS total_revenue,
  COUNT(*) AS transaction_count
FROM fb_collector."FacebookEvent"
WHERE "eventType" = 'checkout.complete'
GROUP BY 1, 2, 3
UNION ALL
SELECT
  date_trunc('hour', timestamp) AS hour,
  'tiktok' AS source,
  NULL AS campaign_id, -- Tiktok events don't have 'campaignId'
  SUM((data->'engagement'->>'purchaseAmount')::numeric) AS total_revenue,
  COUNT(*) AS transaction_count
FROM ttk_collector."TiktokEvent"
WHERE "eventType" = 'purchase'
GROUP BY 1, 2, 3;

-- Index for concurrent refresh
CREATE UNIQUE INDEX idx_report_revenue_hourly_unique ON report_revenue_hourly (hour, source, campaign_id);

-- -----------------------------------------------------
-- View 3: /reports/demographics (Facebook)
-- Unnests and aggregates daily Facebook demographic data.
-- -----------------------------------------------------
CREATE MATERIALIZED VIEW report_demographics_fb_daily AS
SELECT
  date_trunc('day', timestamp) AS day,
  "eventType",
  data->'user'->>'gender' AS gender,
  (data->'user'->>'age')::int AS age,
  data->'user'->'location'->>'country' AS country,
  data->'user'->'location'->>'city' AS city,
  COUNT(DISTINCT data->'user'->>'userId') AS unique_users,
  COUNT(*) AS event_count
FROM fb_collector."FacebookEvent"
WHERE data->'user' IS NOT NULL -- Ensure user data exists
GROUP BY 1, 2, 3, 4, 5, 6;

-- Index for concurrent refresh
CREATE UNIQUE INDEX idx_report_demographics_fb_daily_unique ON report_demographics_fb_daily (day, "eventType", gender, age, country, city);

-- -----------------------------------------------------
-- View 4: /reports/demographics (Tiktok)
-- Unnests and aggregates daily Tiktok demographic data, creating follower segments.
-- -----------------------------------------------------
CREATE MATERIALIZED VIEW report_demographics_tiktok_daily AS
SELECT
  date_trunc('day', timestamp) AS day,
  "eventType",
  data->'engagement'->>'country' AS country,
  CASE 
    WHEN (data->'user'->>'followers')::int < 1000 THEN '0-1k'
    WHEN (data->'user'->>'followers')::int < 10000 THEN '1k-10k'
    WHEN (data->'user'->>'followers')::int < 100000 THEN '10k-100k'
    ELSE '100k+'
  END AS follower_segment,
  COUNT(DISTINCT data->'user'->>'userId') AS unique_users,
  COUNT(*) AS event_count
FROM ttk_collector."TiktokEvent"
WHERE data->'user' IS NOT NULL AND data->'engagement' IS NOT NULL
GROUP BY 1, 2, 3, 4;

-- Index for concurrent refresh
CREATE UNIQUE INDEX idx_report_demographics_tiktok_daily_unique ON report_demographics_tiktok_daily (day, "eventType", country, follower_segment);

