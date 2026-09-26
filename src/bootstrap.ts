// ──────────────────────────────────────────────────────────────
// Bootstrap — wires the default container
//
// Creates a Container pre-loaded with all default adapters.
// Auto-seeds data on first run so `meter init` is optional.
//
// To replace an adapter, call container.bind/singleton after
// bootstrap and before resolving commands.
// ──────────────────────────────────────────────────────────────

import os from 'node:os';
import path from 'node:path';
import { Container, TOKENS } from './container.js';
import type { IStorageAdapter } from './ports/index.js';

// Adapters
import { FileStorageAdapter } from './adapters/file-storage.js';
import { HeuristicTokenizer } from './adapters/heuristic-tokenizer.js';
import { DefaultInputAnalyzer } from './adapters/default-input-analyzer.js';
import { DefaultCostEngine } from './adapters/default-cost-engine.js';
import { SimulatedModelRegistry } from './adapters/simulated-model-registry.js';
import { SimulatedEvaluationEngine } from './adapters/simulated-evaluation-engine.js';
import { SimulatedAdaptationEngine } from './adapters/simulated-adaptation-engine.js';
import { DefaultQualificationService } from './adapters/default-qualification-service.js';
import { DefaultAllocator } from './adapters/default-allocator.js';
import { FileEvidenceStore } from './adapters/file-evidence-store.js';
import { FileTraceStore } from './adapters/file-trace-store.js';
import { SimulatedShadowSimulator } from './adapters/simulated-shadow-simulator.js';
import { SimulatedCanarySimulator } from './adapters/simulated-canary-simulator.js';

// Seed
import {
  SEED_MODELS,
  SEED_WORKFLOW,
  SEED_CONFIGURATIONS,
  SEED_DATASETS,
} from './seed/data.js';

const DATA_DIR = path.join(os.homedir(), '.metercore', 'data');

/**
 * Seed the storage with default models, workflow, configs, and datasets.
 */
async function seedIfEmpty(storage: IStorageAdapter): Promise<boolean> {
  const existing = await storage.list('models');
  if (existing.length > 0) return false; // Already seeded

  for (const model of SEED_MODELS) {
    await storage.write('models', model.id, model);
  }

  await storage.write('workflows', SEED_WORKFLOW.id, SEED_WORKFLOW);

  for (const config of SEED_CONFIGURATIONS) {
    await storage.write('configurations', config.id, config);
  }

  for (const dataset of SEED_DATASETS) {
    await storage.write('datasets', dataset.id, dataset);
  }

  return true;
}

/**
 * Create and wire the default DI container.
 */
export async function bootstrap(): Promise<Container> {
  const container = new Container();

  // ─── Storage (foundation) ──────────────────────────────────
  const storage = new FileStorageAdapter(DATA_DIR);
  container.instance(TOKENS.StorageAdapter, storage);

  // Auto-seed on first run
  await seedIfEmpty(storage);

  // ─── Tokenizer ─────────────────────────────────────────────
  const tokenizer = new HeuristicTokenizer();
  container.instance(TOKENS.Tokenizer, tokenizer);

  // ─── Services ──────────────────────────────────────────────
  container.singleton(
    TOKENS.InputAnalyzer,
    () => new DefaultInputAnalyzer(tokenizer),
  );

  container.singleton(TOKENS.CostEngine, () => new DefaultCostEngine());

  container.singleton(
    TOKENS.ModelRegistry,
    () => new SimulatedModelRegistry(storage),
  );

  container.singleton(
    TOKENS.EvidenceStore,
    () => new FileEvidenceStore(storage),
  );

  container.singleton(TOKENS.TraceStore, () => new FileTraceStore(storage));

  container.singleton(
    TOKENS.EvaluationEngine,
    () => new SimulatedEvaluationEngine(tokenizer),
  );

  // Qualification depends on evaluation + evidence
  container.singleton(
    TOKENS.QualificationService,
    () =>
      new DefaultQualificationService(
        container.get(TOKENS.EvaluationEngine),
        container.get(TOKENS.EvidenceStore),
        storage,
      ),
  );

  container.singleton(TOKENS.Allocator, () => new DefaultAllocator(storage));

  container.singleton(
    TOKENS.AdaptationEngine,
    () =>
      new SimulatedAdaptationEngine(
        storage,
        container.get(TOKENS.ModelRegistry),
      ),
  );

  container.singleton(
    TOKENS.ShadowSimulator,
    () =>
      new SimulatedShadowSimulator(
        storage,
        container.get(TOKENS.EvidenceStore),
        container.get(TOKENS.TraceStore),
      ),
  );

  container.singleton(
    TOKENS.CanarySimulator,
    () => new SimulatedCanarySimulator(storage),
  );

  return container;
}

/**
 * Force re-seed (used by `meter init --force`).
 */
export async function reseed(): Promise<void> {
  const storage = new FileStorageAdapter(DATA_DIR);

  for (const model of SEED_MODELS) {
    await storage.write('models', model.id, model);
  }
  await storage.write('workflows', SEED_WORKFLOW.id, SEED_WORKFLOW);
  for (const config of SEED_CONFIGURATIONS) {
    await storage.write('configurations', config.id, config);
  }
  for (const dataset of SEED_DATASETS) {
    await storage.write('datasets', dataset.id, dataset);
  }
}
