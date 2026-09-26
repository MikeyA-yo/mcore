// ──────────────────────────────────────────────────────────────
// MeterCore Port Interfaces
//
// Every external capability is defined as an interface (port).
// Implementations (adapters) are injected via the DI container.
//
// This follows the "Replaceable infrastructure substrate"
// principle: depend on capabilities, not brand names.
// ──────────────────────────────────────────────────────────────

import type {
  Model,
  ExecutionConfiguration,
  Workflow,
  Dataset,
  InputAnalysis,
  CostEstimate,
  EvaluationRun,
  QualificationEvidence,
  QualificationState,
  StateTransition,
  AllocationDecision,
  RuntimePolicy,
  Trace,
  TraceEvent,
  AdaptationResult,
  AdaptationMethod,
  ShadowSimulationResult,
  CanarySimulationResult,
} from '../domain/types.js';

// ──────────────────────────────────────────────
// Tokenizer Port
// Default: HeuristicTokenizer (chars/4 estimate)
// Replaceable with: tiktoken, gpt-tokenizer, etc.
// ──────────────────────────────────────────────
export interface ITokenizer {
  estimateTokens(text: string): number;
  name(): string;
}

// ──────────────────────────────────────────────
// Input Analyzer Port
// Analyzes input files to produce usage estimates
// ──────────────────────────────────────────────
export interface IInputAnalyzer {
  analyzeFile(filePath: string): Promise<InputAnalysis>;
  analyzeText(text: string): Promise<InputAnalysis>;
}

// ──────────────────────────────────────────────
// Model Registry Port
// Default: file-based simulated registry
// Replaceable with: DB-backed registry, API gateway
// ──────────────────────────────────────────────
export interface IModelRegistry {
  getAll(): Promise<Model[]>;
  getById(id: string): Promise<Model | null>;
  register(model: Model): Promise<void>;
  remove(id: string): Promise<void>;
}

// ──────────────────────────────────────────────
// Cost Engine Port
// Converts usage into estimated execution cost
// Default: token-based formula
// Replaceable with: provider-specific billing APIs
// ──────────────────────────────────────────────
export interface ICostEngine {
  estimate(
    config: ExecutionConfiguration,
    inputTokens: number,
    outputTokens: number,
  ): Promise<CostEstimate>;

  estimateAll(
    configs: ExecutionConfiguration[],
    inputTokens: number,
    outputTokens: number,
  ): Promise<CostEstimate[]>;
}

// ──────────────────────────────────────────────
// Evaluation Engine Port
// Default: simulated evaluation based on config profiles
// Replaceable with: Promptfoo, DeepEval, custom evaluator
// ──────────────────────────────────────────────
export interface IEvaluationEngine {
  evaluate(
    config: ExecutionConfiguration,
    dataset: Dataset,
  ): Promise<EvaluationRun>;

  evaluateRepeated(
    config: ExecutionConfiguration,
    dataset: Dataset,
    runs: number,
  ): Promise<EvaluationRun[]>;
}

// ──────────────────────────────────────────────
// Qualification Service Port
// Manages the COLD → WARM → HOT → DEMOTED lifecycle
// Default: evaluation-based qualification
// Replaceable with: durable workflow (Temporal), policy engine (OPA)
// ──────────────────────────────────────────────
export interface IQualificationService {
  qualify(
    configId: string,
    workflowId: string,
  ): Promise<QualificationEvidence>;

  canPromote(
    configId: string,
    workflowId: string,
  ): Promise<{ canPromote: boolean; reason: string }>;

  promote(
    configId: string,
    evidence: QualificationEvidence,
  ): Promise<StateTransition>;

  demote(configId: string, reason: string): Promise<StateTransition>;
}

// ──────────────────────────────────────────────
// Allocator Port
// Selects among HOT configurations for a workflow
// Default: cheapest-qualifying allocator
// Replaceable with: LLMRouter, weighted routing, etc.
// ──────────────────────────────────────────────
export interface IAllocator {
  allocate(workflowId: string): Promise<AllocationDecision>;
  getCurrentPolicy(workflowId: string): Promise<RuntimePolicy | null>;
}

// ──────────────────────────────────────────────
// Trace Store Port
// Records execution lifecycle events
// Default: file-based JSON traces
// Replaceable with: OpenTelemetry + Jaeger, Langfuse, Grafana
// ──────────────────────────────────────────────
export interface ITraceStore {
  startTrace(workflowId: string): Promise<Trace>;

  addEvent(
    traceId: string,
    event: Omit<TraceEvent, 'id' | 'traceId'>,
  ): Promise<TraceEvent>;

  endTrace(
    traceId: string,
    status: 'COMPLETED' | 'FAILED',
  ): Promise<Trace>;

  getTrace(traceId: string): Promise<Trace | null>;
  listTraces(limit?: number): Promise<Trace[]>;
}

// ──────────────────────────────────────────────
// Evidence Store Port
// Stores qualification evidence for audit
// Default: file-based JSON store
// Replaceable with: PostgreSQL, object storage
// ──────────────────────────────────────────────
export interface IEvidenceStore {
  store(evidence: QualificationEvidence): Promise<void>;
  getByConfigId(configId: string): Promise<QualificationEvidence[]>;
  getById(id: string): Promise<QualificationEvidence | null>;
  getLatest(configId: string): Promise<QualificationEvidence | null>;
  listAll(): Promise<QualificationEvidence[]>;
}

// ──────────────────────────────────────────────
// Storage Adapter Port
// Generic persistence layer
// Default: file-based JSON storage (~/.metercore/data/)
// Replaceable with: PostgreSQL/Drizzle, SQLite, Redis
// ──────────────────────────────────────────────
export interface IStorageAdapter {
  read<T>(collection: string, id: string): Promise<T | null>;
  write(collection: string, id: string, data: unknown): Promise<void>;
  list<T>(collection: string): Promise<T[]>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, predicate: (item: T) => boolean): Promise<T[]>;
  exists(collection: string, id: string): Promise<boolean>;
}

// ──────────────────────────────────────────────
// Adaptation Engine Port
// Simulates model post-training / fine-tuning
// Default: simulated quality-improvement engine
// Replaceable with: TRL, Axolotl, real fine-tuning pipelines
// ──────────────────────────────────────────────
export interface IAdaptationEngine {
  adapt(
    config: ExecutionConfiguration,
    method: AdaptationMethod,
    datasetId: string,
  ): Promise<AdaptationResult>;

  canAdapt(config: ExecutionConfiguration): boolean;
}

// ──────────────────────────────────────────────
// Shadow Simulator Port
// PRD §19: Candidate observes production traffic alongside incumbent
// ──────────────────────────────────────────────
export interface IShadowSimulator {
  simulateShadow(
    candidateConfigId: string,
    workflowId: string,
    requestsCount?: number,
  ): Promise<ShadowSimulationResult>;
}

// ──────────────────────────────────────────────
// Canary Simulator Port
// PRD §20: Progressive traffic ramp-up for HOT candidates
// ──────────────────────────────────────────────
export interface ICanarySimulator {
  simulateCanary(
    candidateConfigId: string,
    workflowId: string,
    totalRequests?: number,
    steps?: number[],
  ): Promise<CanarySimulationResult>;
}

