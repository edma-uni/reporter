-- CreateTable
CREATE TABLE "EventStatistic" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "funnelStage" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userAge" INTEGER,
    "userGender" TEXT,
    "country" TEXT,
    "city" TEXT,
    "username" TEXT,
    "followers" INTEGER,
    "watchTime" INTEGER,
    "percentageWatched" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "purchaseAmount" DECIMAL(10,2) NOT NULL,
    "campaignId" TEXT,
    "adId" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "purchasedItem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemographicRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "country" TEXT,
    "city" TEXT,
    "username" TEXT,
    "followers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemographicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventStatistic_eventId_key" ON "EventStatistic"("eventId");

-- CreateIndex
CREATE INDEX "EventStatistic_timestamp_idx" ON "EventStatistic"("timestamp");

-- CreateIndex
CREATE INDEX "EventStatistic_source_idx" ON "EventStatistic"("source");

-- CreateIndex
CREATE INDEX "EventStatistic_funnelStage_idx" ON "EventStatistic"("funnelStage");

-- CreateIndex
CREATE INDEX "EventStatistic_eventType_idx" ON "EventStatistic"("eventType");

-- CreateIndex
CREATE INDEX "EventStatistic_source_timestamp_idx" ON "EventStatistic"("source", "timestamp");

-- CreateIndex
CREATE INDEX "EventStatistic_source_funnelStage_timestamp_idx" ON "EventStatistic"("source", "funnelStage", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueRecord_eventId_key" ON "RevenueRecord"("eventId");

-- CreateIndex
CREATE INDEX "RevenueRecord_timestamp_idx" ON "RevenueRecord"("timestamp");

-- CreateIndex
CREATE INDEX "RevenueRecord_source_idx" ON "RevenueRecord"("source");

-- CreateIndex
CREATE INDEX "RevenueRecord_source_timestamp_idx" ON "RevenueRecord"("source", "timestamp");

-- CreateIndex
CREATE INDEX "RevenueRecord_campaignId_idx" ON "RevenueRecord"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "DemographicRecord_eventId_key" ON "DemographicRecord"("eventId");

-- CreateIndex
CREATE INDEX "DemographicRecord_timestamp_idx" ON "DemographicRecord"("timestamp");

-- CreateIndex
CREATE INDEX "DemographicRecord_source_idx" ON "DemographicRecord"("source");

-- CreateIndex
CREATE INDEX "DemographicRecord_source_timestamp_idx" ON "DemographicRecord"("source", "timestamp");

-- CreateIndex
CREATE INDEX "DemographicRecord_country_idx" ON "DemographicRecord"("country");

-- CreateIndex
CREATE INDEX "DemographicRecord_gender_idx" ON "DemographicRecord"("gender");
