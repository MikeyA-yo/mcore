// ──────────────────────────────────────────────────────────────
// MeterCore — public API surface
//
// This file exposes the domain types, port interfaces, container,
// and default adapters for programmatic usage (e.g., building
// a web API on top of MeterCore, or writing integration tests).
// ──────────────────────────────────────────────────────────────

// Domain types
export * from './domain/types.js';

// Port interfaces
export type {
  ITokenizer,
  IInputAnalyzer,
  IModelRegistry,
  ICostEngine,
  IEvaluationEngine,
  IQualificationService,
  IAllocator,
  ITraceStore,
  IEvidenceStore,
  IStorageAdapter,
  IAdaptationEngine,
  IShadowSimulator,
  ICanarySimulator,
} from './ports/index.js';

// DI Container
export { Container, TOKENS } from './container.js';

// Bootstrap
export { bootstrap, reseed } from './bootstrap.js';

// Default adapters (for extension / replacement)
export { HeuristicTokenizer } from './adapters/heuristic-tokenizer.js';
export { DefaultInputAnalyzer } from './adapters/default-input-analyzer.js';
export { DefaultCostEngine } from './adapters/default-cost-engine.js';
export { SimulatedModelRegistry } from './adapters/simulated-model-registry.js';
export { SimulatedEvaluationEngine } from './adapters/simulated-evaluation-engine.js';
export { SimulatedAdaptationEngine } from './adapters/simulated-adaptation-engine.js';
export { DefaultQualificationService } from './adapters/default-qualification-service.js';
export { DefaultAllocator } from './adapters/default-allocator.js';
export { FileStorageAdapter } from './adapters/file-storage.js';
export { FileEvidenceStore } from './adapters/file-evidence-store.js';
export { FileTraceStore } from './adapters/file-trace-store.js';
export { SimulatedShadowSimulator } from './adapters/simulated-shadow-simulator.js';
export { SimulatedCanarySimulator } from './adapters/simulated-canary-simulator.js';

// Optimization Service
export { executeOptimizationLoop } from './services/optimizer.js';

// API Server
export { createApiApp, startApiServer } from './api/server.js';

