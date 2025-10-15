# Reporter Service - Architecture & Best Practices

## 🏗️ Service Architecture

```
reporter/
├── src/
│   ├── health/              # Health check endpoints (NEW)
│   │   ├── health.controller.ts
│   │   ├── health.service.ts
│   │   ├── health.module.ts
│   │   └── health.service.spec.ts
│   ├── middleware/          # Request middleware (NEW)
│   │   └── correlation-id.middleware.ts
│   ├── reports/             # Core reporting logic (OPTIMIZED)
│   │   ├── dto/
│   │   │   └── query-filters.dto.ts  # With validation
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts        # Optimized queries
│   │   ├── reports.service.spec.ts   # Unit tests (NEW)
│   │   └── reports.module.ts
│   ├── events/              # NATS event consumer
│   │   ├── event-consumer.service.ts
│   │   ├── events.module.ts
│   │   └── types.ts
│   ├── nats/                # NATS connection
│   │   └── nats-consumer.service.ts
│   ├── prisma/              # Database layer (ENHANCED)
│   │   ├── prisma.service.ts         # With logging & pool config
│   │   └── prisma.module.ts
│   ├── metrics/             # Prometheus metrics
│   │   ├── metrics.service.ts
│   │   └── metrics.module.ts
│   ├── app.module.ts        # Root module (CLEANED)
│   └── main.ts              # Bootstrap (ENHANCED)
```

---

## 🔄 Request Flow

### 1. HTTP API Request Flow

```
Client Request
    ↓
[Correlation ID Middleware] → Adds x-correlation-id
    ↓
[ValidationPipe] → Validates DTOs
    ↓
[ReportsController] → Routes to service
    ↓
[ReportsService] → Executes optimized queries
    ↓
[PrismaService] → Database operations with logging
    ↓
[MetricsService] → Records latency
    ↓
Response with correlation-id header
```

### 2. NATS Event Processing Flow

```
NATS JetStream (processed.events.>)
    ↓
[NatsConsumerService] → Durable subscription
    ↓
[EventConsumerService] → Process event by source
    ↓
[PrismaService] → Store in denormalized tables
    │
    ├─→ EventStatistic (all events)
    ├─→ DemographicRecord (user demographics)
    └─→ RevenueRecord (transactional events only)
    ↓
Message acknowledged (or redelivered on error)
```

---

## 🎯 Design Patterns Used

### 1. **Dependency Injection** (NestJS Built-in)

- All services injected via constructor
- Enables easy testing with mocks
- Promotes loose coupling

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly metrics: MetricsService,
) {}
```

### 2. **Repository Pattern** (Prisma)

- PrismaService acts as repository
- Abstracts database operations
- Centralizes query logic

### 3. **Middleware Pattern**

- CorrelationIdMiddleware for request tracking
- Applied globally via AppModule

### 4. **Observer Pattern** (NATS Consumer)

- Event-driven architecture
- Subscribes to NATS subjects
- Processes events asynchronously

### 5. **Factory Pattern** (NestFactory)

- Creates and configures application
- Sets up pipes, middleware, shutdown hooks

---

## 📊 Database Design (Denormalized)

### Why Denormalized?

✅ **Fast reads** - No complex joins needed  
✅ **Schema simplicity** - One table per report type  
✅ **Query optimization** - Indexes on frequently queried fields  
❌ Trade-off: More storage space (acceptable for analytics)

### Tables:

#### **EventStatistic** (All Events)

```prisma
- General: timestamp, source, funnelStage, eventType
- Facebook: userId, userName, userAge, userGender, country, city
- TikTok: username, followers, watchTime, percentageWatched
- Indexes: timestamp, source, funnelStage, eventType, composites
```

#### **RevenueRecord** (Transactional Events Only)

```prisma
- General: timestamp, source, eventType, purchaseAmount
- Facebook: campaignId, adId, userId
- TikTok: username, purchasedItem
- Indexes: timestamp, source, campaignId
```

#### **DemographicRecord** (User Demographics)

```prisma
- General: timestamp, source
- Facebook: userId, userName, age, gender, country, city
- TikTok: username, followers
- Indexes: timestamp, source, country, gender
```

---

## 🔍 Query Optimization Techniques

### 1. **Selective Field Fetching**

```typescript
// ❌ Before: Fetch all fields
findMany({ where });

// ✅ After: Fetch only needed fields
findMany({
  where,
  select: {
    eventId: true,
    timestamp: true,
    source: true,
    // ... only required fields
  },
});
```

### 2. **Parallel Queries with Promise.all()**

```typescript
// ❌ Before: Sequential queries (slow)
const count = await prisma.count();
const data = await prisma.findMany();
const aggregated = await prisma.groupBy();

// ✅ After: Parallel execution
const [count, data, aggregated] = await Promise.all([
  prisma.count(),
  prisma.findMany(),
  prisma.groupBy(),
]);
```

### 3. **Conditional Aggregations**

```typescript
// Only compute aggregations when needed
const fbAggregates =
  query.source === 'tiktok' ? null : await getFacebookAggregates();
```

### 4. **Result Limiting**

```typescript
// Always limit result sets
findMany({
  where,
  take: 100, // Prevent memory issues
  orderBy: { timestamp: 'desc' },
});
```

---

## 🛡️ Error Handling Strategy

### 1. **Service-Level Error Handling**

```typescript
try {
  // Query logic
} catch (error) {
  this.logger.error('Context-specific error message', error);
  throw error; // Let NestJS handle HTTP status
} finally {
  // Always record metrics
  this.metrics.recordReportQueryDuration(type, duration);
}
```

### 2. **NATS Error Handling**

```typescript
try {
  await processEvent(data);
  msg.ack(); // Success
} catch (error) {
  this.logger.error('Processing error', error);
  // DON'T ack - let NATS redeliver
}
```

### 3. **Database Error Handling**

- Prisma errors logged automatically
- Slow queries (>1s) logged in production
- Connection issues handled by Prisma retry logic

---

## 📈 Metrics & Observability

### 1. **Custom Metrics**

```typescript
// Query duration histogram
reporter_query_duration_seconds{report_type="events"}
reporter_query_duration_seconds{report_type="revenue"}
reporter_query_duration_seconds{report_type="demographics"}
```

### 2. **Default Node.js Metrics**

- CPU usage: `reporter_process_cpu_*`
- Memory: `reporter_process_resident_memory_bytes`
- Heap: `reporter_nodejs_heap_size_*`
- Event loop lag: `reporter_nodejs_eventloop_lag_seconds`

### 3. **HTTP Request Logging**

```
[correlationId] METHOD URL - Started from IP
[correlationId] METHOD URL - STATUS - DURATIONms
```

---

## 🔐 Security Best Practices

### 1. **Input Validation**

- ✅ All API inputs validated with `class-validator`
- ✅ Date format validation (ISO 8601)
- ✅ Enum validation for source/funnelStage
- ✅ Unknown properties stripped

### 2. **SQL Injection Prevention**

- ✅ Prisma uses parameterized queries
- ✅ No raw SQL with user input
- ✅ All values properly escaped

### 3. **CORS** (if needed)

```typescript
// Add to main.ts if exposing to browsers
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
});
```

---

## 🚦 Health Check Implementation

### Liveness vs Readiness

#### **Liveness Probe** (`/health/live`)

- **Purpose:** Is the app alive?
- **Checks:** Application is running
- **K8s Action:** Restart pod if fails
- **Return:** Always 200 (if code runs)

#### **Readiness Probe** (`/health/ready`)

- **Purpose:** Can the app handle traffic?
- **Checks:** Database + NATS connectivity
- **K8s Action:** Remove from service if fails
- **Return:** 200 if ready, 503 if not

### Kubernetes Configuration Example

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3005
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3005
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

---

## 🔄 Graceful Shutdown Process

```
1. Receive SIGTERM/SIGINT
2. Stop accepting new HTTP connections
3. Wait for in-flight requests to complete
4. Close NATS subscription (drain messages)
5. Disconnect from database
6. Log shutdown completion
7. Exit process
```

**Implementation:**

```typescript
// In main.ts
app.enableShutdownHooks();

process.on('SIGTERM', () => {
  void (async () => {
    await app.close();
    logger.log('Graceful shutdown complete');
  })();
});
```

---

## 🧪 Testing Strategy

### 1. **Unit Tests**

- Mock Prisma service
- Mock Metrics service
- Test business logic in isolation
- Fast execution (<1s per test)

### 2. **Integration Tests** (Optional)

- Use test database
- Real Prisma client
- Test actual queries
- Slower but more realistic

### 3. **E2E Tests** (Optional)

- Full application context
- Real database + NATS (via docker-compose)
- Test HTTP endpoints
- Test event processing

---

## 📦 Deployment Considerations

### Environment-Specific Configurations

#### **Development**

```env
NODE_ENV=development
REPORTER_DATABASE_URL=postgresql://localhost:5432/reporter_dev
LOG_LEVEL=debug
```

#### **Production**

```env
NODE_ENV=production
REPORTER_DATABASE_URL=postgresql://user:pass@prod-host:5432/reporter?connection_limit=50
LOG_LEVEL=warn
```

### Container Resources

```yaml
# docker-compose.yml or K8s deployment
resources:
  requests:
    memory: '512Mi'
    cpu: '250m'
  limits:
    memory: '1Gi'
    cpu: '500m'
```

### Scaling Considerations

- ✅ **Horizontal scaling:** Multiple reporter instances can run
- ✅ **NATS durable subscriptions:** Work sharing across instances
- ✅ **Database connection pooling:** Adjust per instance
- ⚠️ **Avoid:** Don't scale beyond DB connection limit

---

## 🎛️ Configuration Options

### Prisma Configuration

```typescript
// Adjust in prisma.service.ts constructor
new PrismaClient({
  log: ['query', 'error', 'warn'], // Logging levels
  errorFormat: 'pretty', // Error formatting
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

### NATS Configuration

```typescript
// In nats-consumer.service.ts
connect({
  servers: process.env.NATS_URL,
  name: `reporter-${process.env.HOSTNAME}`,
  maxReconnectAttempts: -1, // Infinite retries
  reconnectTimeWait: 1000, // 1s between retries
  timeout: 10000, // 10s connection timeout
  pingInterval: 20000, // 20s keepalive
  maxPingOut: 3, // Fail after 3 missed pings
});
```

---

## 🎯 Performance Benchmarks (Expected)

### Query Latency Targets

- **p50:** < 50ms
- **p95:** < 200ms
- **p99:** < 500ms

### Throughput

- **Reports API:** 100-500 req/s (depends on complexity)
- **Event Processing:** 1000+ events/s

### Resource Usage

- **Memory:** 200-500 MB
- **CPU:** 0.1-0.5 cores (idle to moderate load)

---

## 🔍 Troubleshooting Guide

### High Latency

1. Check Grafana dashboard for bottleneck
2. Review slow query logs
3. Verify database indexes
4. Check connection pool saturation

### Memory Leaks

1. Monitor `reporter_nodejs_heap_size_total_bytes`
2. Check for unacknowledged NATS messages
3. Review query result set sizes

### Connection Issues

1. Check `/health/ready` endpoint
2. Review NATS connection logs
3. Verify database credentials
4. Check network connectivity

---

## 📚 Further Reading

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboard Design](https://grafana.com/docs/grafana/latest/dashboards/)

---

## ✅ Checklist for Production

- [x] Health checks implemented
- [x] Metrics exposed
- [x] Grafana dashboards configured
- [x] Error handling comprehensive
- [x] Logging structured
- [x] Graceful shutdown implemented
- [x] Tests added
- [x] Documentation complete
- [ ] Load testing performed
- [ ] Alerting rules configured
- [ ] Backup strategy defined
- [ ] Monitoring on-call setup

---

**Your reporter service is now enterprise-ready! 🚀**
