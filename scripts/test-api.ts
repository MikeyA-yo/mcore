// ──────────────────────────────────────────────────────────────
// API In-Memory Endpoint Verification Script
//
// Tests all Hono endpoints using Hono's native app.request()
// ──────────────────────────────────────────────────────────────

import { bootstrap } from '../src/bootstrap.js';
import { createApiApp } from '../src/api/server.js';

async function testApi() {
  console.log('🧪 Starting API Verification Tests...\n');

  const container = await bootstrap();
  const app = createApiApp(container);

  let passed = 0;
  let failed = 0;

  async function check(name: string, path: string, options: RequestInit = {}) {
    try {
      const res = await app.request(path, options);
      if (res.status >= 200 && res.status < 300) {
        console.log(`  ✓ [${res.status}] ${name} (${options.method || 'GET'} ${path})`);
        passed++;
        return await res.json();
      } else {
        const body = await res.text();
        console.error(`  ✗ [${res.status}] ${name} (${options.method || 'GET'} ${path}) — ${body}`);
        failed++;
        return null;
      }
    } catch (err: unknown) {
      console.error(`  ✗ ERROR ${name}: ${(err as Error).message}`);
      failed++;
      return null;
    }
  }

  // 1. Health
  await check('Health Check', '/api/health');

  // 2. Overview / Metrics
  const overview = await check('Overview Metrics', '/api/overview');
  console.log(`    Active configs: ${overview?.configurationsCount}, Baseline: $${overview?.baselineCost}, Optimized: $${overview?.optimizedCost}, Savings: ${overview?.savingsPercent}%`);

  // 3. Models
  const models = await check('List Models', '/api/models');
  console.log(`    Models returned: ${models?.length}`);

  // 4. Configurations
  const configs = await check('List Configurations', '/api/configurations');
  console.log(`    Configurations returned: ${configs?.length}`);

  // 5. Workflows
  const workflows = await check('List Workflows', '/api/workflows');
  console.log(`    Workflows returned: ${workflows?.length}`);

  // 6. Datasets
  const datasets = await check('List Datasets', '/api/datasets');
  console.log(`    Datasets returned: ${datasets?.length}`);

  // 7. Input Analysis
  await check('Analyze Text', '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Customer charged twice for subscription renewal and requested refund immediately.' }),
  });

  // 8. Evaluation
  await check('Evaluate Config', '/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configId: 'small-x-default', datasetId: 'gold-v1', runs: 3 }),
  });

  // 9. Shadow Simulation
  await check('Shadow Simulation', '/api/shadow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateConfigId: 'frontier-y-default', requestsCount: 50 }),
  });

  // 10. Canary Simulation
  await check('Canary Simulation', '/api/canary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateConfigId: 'frontier-y-default', totalRequests: 500 }),
  });

  // 11. Allocation
  const alloc = await check('Allocate Active Policy', '/api/allocate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId: 'refund-resolution' }),
  });
  console.log(`    Selected Primary: ${alloc?.selectedConfigId}, Fallback: ${alloc?.policy?.fallback?.join(', ')}`);

  // 12. Full Optimization Loop
  const opt = await check('Full Optimization Loop', '/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Refund request for billing error.', workflowId: 'refund-resolution' }),
  });
  console.log(`    Optimization Trace: ${opt?.traceId}, Savings: ${opt?.estimatedSavings?.savingsPercent}%`);

  // 13. Traces
  const traces = await check('List Traces', '/api/traces?limit=5');
  console.log(`    Traces returned: ${traces?.length}`);

  if (traces && traces.length > 0) {
    await check('Get Single Trace', `/api/traces/${traces[0].id}`);
  }

  // 14. Evidence
  const evidence = await check('List Evidence', '/api/evidence');
  console.log(`    Evidence records returned: ${evidence?.length}`);

  // 15. Simulate Degradation (Demo step 8)
  const deg = await check('Simulate Degradation & Fallback', '/api/simulate-degradation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configId: 'frontier-x-default', degradedQuality: 0.980 }),
  });
  console.log(`    Degradation message: ${deg?.message}`);

  console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);

  // Clean re-seed
  await check('Reset / Reseed Data', '/api/init', { method: 'POST' });
}

testApi().catch(console.error);
