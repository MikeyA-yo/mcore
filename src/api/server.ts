// ──────────────────────────────────────────────────────────────
// MeterCore HTTP REST API Server
//
// Built with Hono (PRD §27):
// Exposes the core optimization engine, lifecycle management,
// evidence store, trace store, and simulations over HTTP.
// Consumed by the React + shadcn Web Dashboard and automation.
// ──────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Container, TOKENS } from '../container.js';
import type {
  IInputAnalyzer,
  ICostEngine,
  IEvaluationEngine,
  IQualificationService,
  IAllocator,
  ITraceStore,
  IEvidenceStore,
  IStorageAdapter,
  IModelRegistry,
  IShadowSimulator,
  ICanarySimulator,
} from '../ports/index.js';
import type {
  ExecutionConfiguration,
  Workflow,
  Dataset,
} from '../domain/types.js';
import { QualificationState } from '../domain/types.js';
import { reseed } from '../bootstrap.js';
import { executeOptimizationLoop } from '../services/optimizer.js';

export function createApiApp(container: Container): Hono {
  const app = new Hono();

  // Enable CORS for web dashboard clients
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  // Resolve dependencies from container
  const storage = container.get<IStorageAdapter>(TOKENS.StorageAdapter);
  const modelRegistry = container.get<IModelRegistry>(TOKENS.ModelRegistry);
  const inputAnalyzer = container.get<IInputAnalyzer>(TOKENS.InputAnalyzer);
  const costEngine = container.get<ICostEngine>(TOKENS.CostEngine);
  const evalEngine = container.get<IEvaluationEngine>(TOKENS.EvaluationEngine);
  const qualService = container.get<IQualificationService>(TOKENS.QualificationService);
  const allocator = container.get<IAllocator>(TOKENS.Allocator);
  const evidenceStore = container.get<IEvidenceStore>(TOKENS.EvidenceStore);
  const traceStore = container.get<ITraceStore>(TOKENS.TraceStore);
  const shadowSimulator = container.get<IShadowSimulator>(TOKENS.ShadowSimulator);
  const canarySimulator = container.get<ICanarySimulator>(TOKENS.CanarySimulator);

  // ─── Health ─────────────────────────────────────────────────
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      service: 'metercore-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Overview / Metrics (for Dashboard KPI cards) ───────────
  app.get('/api/overview', async (c) => {
    const workflows = await storage.list<Workflow>('workflows');
    const configs = await storage.list<ExecutionConfiguration>('configurations');
    const traces = await traceStore.listTraces(10);
    const evidence = await evidenceStore.listAll();

    const stateCounts = {
      HOT: configs.filter((cfg) => cfg.state === QualificationState.HOT).length,
      WARM: configs.filter((cfg) => cfg.state === QualificationState.WARM).length,
      COLD: configs.filter((cfg) => cfg.state === QualificationState.COLD).length,
      DEMOTED: configs.filter((cfg) => cfg.state === QualificationState.DEMOTED).length,
    };

    // Calculate baseline incumbent vs cheapest hot config
    const frontier = configs.find((cfg) => cfg.id.includes('frontier')) || configs[0];
    const hotConfigs = configs.filter((cfg) => cfg.state === QualificationState.HOT);

    const calcCaseCost = (cfg: ExecutionConfiguration) =>
      (5000 / 1_000_000) * cfg.inputCostPerMillionTokens +
      (1000 / 1_000_000) * cfg.outputCostPerMillionTokens;

    const baselineCost = frontier ? Math.round(calcCaseCost(frontier) * 10000) / 10000 : 0.08;
    const cheapestHot = hotConfigs.reduce<ExecutionConfiguration | null>((cheapest, cfg) => {
      if (!cheapest) return cfg;
      return calcCaseCost(cfg) < calcCaseCost(cheapest) ? cfg : cheapest;
    }, null);

    const optimizedCost = cheapestHot
      ? Math.round(calcCaseCost(cheapestHot) * 10000) / 10000
      : baselineCost;

    const savingsPercent =
      baselineCost > 0
        ? Math.round(((baselineCost - optimizedCost) / baselineCost) * 1000) / 10
        : 0;

    return c.json({
      workflowsCount: workflows.length,
      configurationsCount: configs.length,
      stateCounts,
      baselineCost,
      optimizedCost,
      savingsPercent,
      totalTracesCount: traces.length,
      totalEvidenceCount: evidence.length,
      activePolicy: workflows[0] ? await allocator.getCurrentPolicy(workflows[0].id) : null,
      latestTrace: traces[0] || null,
    });
  });

  // ─── Models ─────────────────────────────────────────────────
  app.get('/api/models', async (c) => {
    const models = await modelRegistry.getAll();
    return c.json(models);
  });

  // ─── Configurations ─────────────────────────────────────────
  app.get('/api/configurations', async (c) => {
    const workflowId = c.req.query('workflowId');
    const state = c.req.query('state');

    let configs = await storage.list<ExecutionConfiguration>('configurations');
    if (workflowId) {
      configs = configs.filter((cfg) => cfg.workflowId === workflowId);
    }
    if (state) {
      configs = configs.filter((cfg) => cfg.state === state);
    }
    return c.json(configs);
  });

  app.get('/api/configurations/:id', async (c) => {
    const id = c.req.param('id');
    const config = await storage.read<ExecutionConfiguration>('configurations', id);
    if (!config) {
      return c.json({ error: `Configuration '${id}' not found` }, 404);
    }
    return c.json(config);
  });

  app.post('/api/configurations/:id/demote', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const reason = body.reason || 'Manual administrative demotion via API';

    const config = await storage.read<ExecutionConfiguration>('configurations', id);
    if (!config) {
      return c.json({ error: `Configuration '${id}' not found` }, 404);
    }

    const transition = await qualService.demote(id, reason);

    // Re-evaluate allocation to trigger fallback
    let newPolicy = null;
    try {
      const allocation = await allocator.allocate(config.workflowId);
      newPolicy = allocation.policy;
    } catch {
      // No hot configs remaining
    }

    return c.json({
      success: true,
      transition,
      newPolicy,
      message: `Configuration '${id}' demoted from ${transition.fromState} to ${transition.toState}`,
    });
  });

  // ─── Input Analysis ─────────────────────────────────────────
  app.post('/api/analyze', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.text) {
      const result = await inputAnalyzer.analyzeText(body.text);
      return c.json(result);
    }
    if (body.filePath) {
      try {
        const result = await inputAnalyzer.analyzeFile(body.filePath);
        return c.json(result);
      } catch (err: unknown) {
        return c.json({ error: (err as Error).message }, 400);
      }
    }
    return c.json({ error: 'Either "text" or "filePath" must be provided in body' }, 400);
  });

  // ─── Evaluation ─────────────────────────────────────────────
  app.post('/api/evaluate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { configId, datasetId = 'gold-v1', runs = 5 } = body;

    if (!configId) {
      return c.json({ error: 'configId is required' }, 400);
    }

    const config = await storage.read<ExecutionConfiguration>('configurations', configId);
    if (!config) {
      return c.json({ error: `Configuration '${configId}' not found` }, 404);
    }

    const dataset = await storage.read<Dataset>('datasets', datasetId);
    if (!dataset) {
      return c.json({ error: `Dataset '${datasetId}' not found` }, 404);
    }

    const runResults = await evalEngine.evaluateRepeated(config, dataset, runs);
    const meanQuality = runResults.reduce((a, b) => a + b.aggregateQuality, 0) / runResults.length;
    const criticalFailures = runResults.reduce((a, b) => a + b.criticalFailures, 0);
    const meanLatency = runResults.reduce((a, b) => a + b.p95LatencyMs, 0) / runResults.length;

    return c.json({
      configId,
      datasetId,
      runs: runResults.length,
      aggregateQuality: Math.round(meanQuality * 1000) / 1000,
      criticalFailures,
      meanLatencyMs: Math.round(meanLatency),
      runsDetails: runResults,
    });
  });

  // ─── Qualification ──────────────────────────────────────────
  app.post('/api/qualify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { configId, workflowId = 'refund-resolution' } = body;

    if (!configId) {
      return c.json({ error: 'configId is required' }, 400);
    }

    const evidence = await qualService.qualify(configId, workflowId);
    return c.json({
      success: true,
      decision: evidence.decision,
      fromState: evidence.fromState,
      toState: evidence.toState,
      evidence,
    });
  });

  // ─── Shadow Traffic Simulation ──────────────────────────────
  app.post('/api/shadow', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { candidateConfigId, workflowId = 'refund-resolution', requestsCount = 100 } = body;

    if (!candidateConfigId) {
      return c.json({ error: 'candidateConfigId is required' }, 400);
    }

    try {
      const result = await shadowSimulator.simulateShadow(
        candidateConfigId,
        workflowId,
        requestsCount,
      );
      return c.json(result);
    } catch (err: unknown) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ─── Canary Traffic Simulation ──────────────────────────────
  app.post('/api/canary', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const {
      candidateConfigId,
      workflowId = 'refund-resolution',
      totalRequests = 1000,
      steps = [5, 10, 25, 50, 100],
    } = body;

    if (!candidateConfigId) {
      return c.json({ error: 'candidateConfigId is required' }, 400);
    }

    try {
      const result = await canarySimulator.simulateCanary(
        candidateConfigId,
        workflowId,
        totalRequests,
        steps,
      );
      return c.json(result);
    } catch (err: unknown) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ─── Allocation ─────────────────────────────────────────────
  app.post('/api/allocate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const workflowId = body.workflowId || 'refund-resolution';

    try {
      const decision = await allocator.allocate(workflowId);
      return c.json(decision);
    } catch (err: unknown) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // ─── Full Optimization Loop ─────────────────────────────────
  app.post('/api/optimize', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const input = body.text || body.input || 'Customer charged twice for subscription renewal.';
    const isText = body.text !== undefined || body.isText === true;
    const workflowId = body.workflowId || 'refund-resolution';

    try {
      const result = await executeOptimizationLoop(container, {
        input,
        isText,
        workflowId,
      });
      return c.json(result);
    } catch (err: unknown) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // ─── Simulate Degradation (Demo Step 8) ──────────────────────
  app.post('/api/simulate-degradation', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { configId, degradedQuality = 0.982, workflowId = 'refund-resolution' } = body;

    if (!configId) {
      return c.json({ error: 'configId is required' }, 400);
    }

    const config = await storage.read<ExecutionConfiguration>('configurations', configId);
    if (!config) {
      return c.json({ error: `Configuration '${configId}' not found` }, 404);
    }

    const originalQuality = config.quality;
    config.quality = degradedQuality;
    config.updatedAt = new Date().toISOString();
    await storage.write('configurations', config.id, config);

    // Demote because degradedQuality violates Capability Contract
    const transition = await qualService.demote(
      configId,
      `Simulated quality drop: ${(degradedQuality * 100).toFixed(1)}% < contract threshold (99.0%)`,
    );

    // Fallback allocation
    let fallbackPolicy = null;
    let fallbackSelectedId = '';
    try {
      const allocation = await allocator.allocate(workflowId);
      fallbackPolicy = allocation.policy;
      fallbackSelectedId = allocation.selectedConfigId;
    } catch {
      // No hot configs available
    }

    return c.json({
      success: true,
      configId,
      originalQuality,
      degradedQuality,
      transition,
      fallbackSelectedId,
      fallbackPolicy,
      message: `Configuration '${configId}' degraded to ${(degradedQuality * 100).toFixed(1)}% and DEMOTED. Fallback active: ${fallbackSelectedId}`,
    });
  });

  // ─── Evidence ───────────────────────────────────────────────
  app.get('/api/evidence', async (c) => {
    const configId = c.req.query('configId');
    if (configId) {
      const items = await evidenceStore.getByConfigId(configId);
      return c.json(items);
    }
    const all = await evidenceStore.listAll();
    return c.json(all);
  });

  app.get('/api/evidence/:id', async (c) => {
    const id = c.req.param('id');
    const item = await evidenceStore.getById(id);
    if (!item) {
      return c.json({ error: `Evidence '${id}' not found` }, 404);
    }
    return c.json(item);
  });

  // ─── Traces ─────────────────────────────────────────────────
  app.get('/api/traces', async (c) => {
    const limit = Number(c.req.query('limit')) || 50;
    const traces = await traceStore.listTraces(limit);
    return c.json(traces);
  });

  app.get('/api/traces/:id', async (c) => {
    const id = c.req.param('id');
    const trace = await traceStore.getTrace(id);
    if (!trace) {
      return c.json({ error: `Trace '${id}' not found` }, 404);
    }
    return c.json(trace);
  });

  // ─── Workflows ──────────────────────────────────────────────
  app.get('/api/workflows', async (c) => {
    const workflows = await storage.list<Workflow>('workflows');
    return c.json(workflows);
  });

  app.get('/api/workflows/:id', async (c) => {
    const id = c.req.param('id');
    const workflow = await storage.read<Workflow>('workflows', id);
    if (!workflow) {
      return c.json({ error: `Workflow '${id}' not found` }, 404);
    }
    return c.json(workflow);
  });

  // ─── Datasets ───────────────────────────────────────────────
  app.get('/api/datasets', async (c) => {
    const datasets = await storage.list<Dataset>('datasets');
    return c.json(datasets);
  });

  // ─── Seed / Reset ───────────────────────────────────────────
  app.post('/api/init', async (c) => {
    await reseed();
    return c.json({
      success: true,
      message: 'MeterCore state successfully re-initialized with seed baseline data',
    });
  });

  // ─── Static Dashboard Serving ───────────────────────────────
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateDirs = [
    path.resolve(currentDir, '../dashboard/dist'),
    path.resolve(process.cwd(), 'dashboard/dist'),
  ];
  const dashboardDist = candidateDirs.find((d) => fs.existsSync(d));

  if (dashboardDist) {
    app.use('/assets/*', serveStatic({ root: dashboardDist }));
    app.get('*', (c) => {
      // Don't intercept /api routes
      if (c.req.path.startsWith('/api')) {
        return c.json({ error: 'Endpoint not found' }, 404);
      }
      const htmlPath = path.join(dashboardDist, 'index.html');
      if (fs.existsSync(htmlPath)) {
        return c.html(fs.readFileSync(htmlPath, 'utf-8'));
      }
      return c.text('Dashboard build not found', 404);
    });
  }

  return app;
}

export function startApiServer(container: Container, port = 3001) {
  const app = createApiApp(container);
  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`\n  ⚡ MeterCore REST API listening at http://localhost:${info.port}`);
    console.log(`  📚 Health endpoint: http://localhost:${info.port}/api/health`);
    console.log(`  📊 Overview endpoint: http://localhost:${info.port}/api/overview\n`);
  });

  return server;
}
