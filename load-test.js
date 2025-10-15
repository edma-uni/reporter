const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS) || 10;
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS) || 100;
const WARMUP_REQUESTS = 10;

// Parse URL
const url = new URL(BASE_URL);

// Test endpoints
const endpoints = [
  { path: '/reports/events', name: 'Events (all)' },
  { path: '/reports/events?source=facebook', name: 'Events (Facebook)' },
  { path: '/reports/events?source=tiktok&funnelStage=top', name: 'Events (TikTok Top)' },
  { path: '/reports/events?funnelStage=bottom', name: 'Events (Bottom Funnel)' },
  { path: '/reports/revenue', name: 'Revenue (all)' },
  { path: '/reports/revenue?source=facebook', name: 'Revenue (Facebook)' },
  { path: '/reports/revenue?source=tiktok', name: 'Revenue (TikTok)' },
  { path: '/reports/demographics', name: 'Demographics (all)' },
  { path: '/reports/demographics?source=facebook', name: 'Demographics (Facebook)' },
  { path: '/reports/demographics?source=tiktok', name: 'Demographics (TikTok)' },
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Make HTTP request
function makeRequest(path) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: path,
      method: 'GET',
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode === 200,
          size: data.length,
        });
      });
    });
    
    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        statusCode: 0,
        duration,
        success: false,
        error: error.message,
      });
    });
    
    req.end();
  });
}

// Test single endpoint
async function testEndpoint(endpoint, requests = 1, concurrent = 1) {
  const results = [];
  
  for (let i = 0; i < requests; i += concurrent) {
    const batch = Math.min(concurrent, requests - i);
    const promises = Array(batch).fill().map(() => makeRequest(endpoint.path));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }
  
  return results;
}

// Calculate statistics
function calculateStats(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const durations = successful.map(r => r.duration).sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  
  const stats = {
    total: results.length,
    success: successful.length,
    failed: failed.length,
    successRate: (successful.length / results.length * 100).toFixed(2),
    avgDuration: durations.length > 0 ? (totalDuration / durations.length).toFixed(2) : 0,
    minDuration: durations[0] || 0,
    maxDuration: durations[durations.length - 1] || 0,
    p50: durations[Math.floor(durations.length * 0.5)] || 0,
    p95: durations[Math.floor(durations.length * 0.95)] || 0,
    p99: durations[Math.floor(durations.length * 0.99)] || 0,
  };
  
  return stats;
}

// Print results
function printResults(endpoint, stats) {
  const statusColor = stats.successRate >= 99 ? colors.green : 
                      stats.successRate >= 95 ? colors.yellow : colors.red;
  
  console.log(`\n${colors.cyan}${endpoint.name}${colors.reset}`);
  console.log(`  Endpoint: ${endpoint.path}`);
  console.log(`  Total Requests: ${stats.total}`);
  console.log(`  ${statusColor}Success: ${stats.success} (${stats.successRate}%)${colors.reset}`);
  
  if (stats.failed > 0) {
    console.log(`  ${colors.red}Failed: ${stats.failed}${colors.reset}`);
  }
  
  console.log(`  Response Times:`);
  console.log(`    Average: ${stats.avgDuration}ms`);
  console.log(`    Min: ${stats.minDuration}ms | Max: ${stats.maxDuration}ms`);
  console.log(`    p50: ${stats.p50}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms`);
}

// Test health endpoints
async function testHealth() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Testing Health Endpoints${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const liveness = await makeRequest('/health/live');
  console.log(`\n${colors.cyan}Liveness:${colors.reset} ${liveness.success ? colors.green + '✓ OK' : colors.red + '✗ FAILED'}${colors.reset} (${liveness.duration}ms)`);
  
  const readiness = await makeRequest('/health/ready');
  console.log(`${colors.cyan}Readiness:${colors.reset} ${readiness.success ? colors.green + '✓ OK' : colors.red + '✗ FAILED'}${colors.reset} (${readiness.duration}ms)`);
  
  if (!liveness.success || !readiness.success) {
    console.log(`\n${colors.red}⚠️  Service is not healthy. Aborting load test.${colors.reset}`);
    process.exit(1);
  }
}

// Main load test
async function runLoadTest() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║  Reporter Service Load Test           ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nConfiguration:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Total Requests per Endpoint: ${TOTAL_REQUESTS}`);
  console.log(`  Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`  Warmup Requests: ${WARMUP_REQUESTS}`);
  
  // Test health first
  await testHealth();
  
  // Warmup
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Warmup Phase${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`\nRunning ${WARMUP_REQUESTS} warmup requests...`);
  
  await testEndpoint(endpoints[0], WARMUP_REQUESTS, CONCURRENT_REQUESTS);
  console.log(`${colors.green}✓ Warmup complete${colors.reset}`);
  
  // Run load tests
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Load Test Results${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const allStats = [];
  
  for (const endpoint of endpoints) {
    process.stdout.write(`\nTesting ${endpoint.name}... `);
    const results = await testEndpoint(endpoint, TOTAL_REQUESTS, CONCURRENT_REQUESTS);
    const stats = calculateStats(results);
    process.stdout.write(`${colors.green}✓${colors.reset}`);
    printResults(endpoint, stats);
    allStats.push({ endpoint, stats });
  }
  
  // Summary
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Summary${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  const totalRequests = allStats.reduce((sum, s) => sum + s.stats.total, 0);
  const totalSuccess = allStats.reduce((sum, s) => sum + s.stats.success, 0);
  const overallSuccessRate = (totalSuccess / totalRequests * 100).toFixed(2);
  
  const avgP50 = (allStats.reduce((sum, s) => sum + parseFloat(s.stats.p50), 0) / allStats.length).toFixed(2);
  const avgP95 = (allStats.reduce((sum, s) => sum + parseFloat(s.stats.p95), 0) / allStats.length).toFixed(2);
  const avgP99 = (allStats.reduce((sum, s) => sum + parseFloat(s.stats.p99), 0) / allStats.length).toFixed(2);
  
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  ${colors.green}Successful: ${totalSuccess} (${overallSuccessRate}%)${colors.reset}`);
  console.log(`  Failed: ${totalRequests - totalSuccess}`);
  console.log(`\n  Average Latencies Across All Endpoints:`);
  console.log(`    p50: ${avgP50}ms`);
  console.log(`    p95: ${avgP95}ms`);
  console.log(`    p99: ${avgP99}ms`);
  
  // Recommendations
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Monitoring${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  console.log(`  📊 Prometheus Metrics: ${BASE_URL}/metrics`);
  console.log(`  📈 Grafana Dashboard: http://localhost:3002`);
  console.log(`\n${colors.green}✅ Load test completed successfully!${colors.reset}\n`);
}

// Run the test
runLoadTest().catch(error => {
  console.error(`\n${colors.red}Error running load test:${colors.reset}`, error);
  process.exit(1);
});
