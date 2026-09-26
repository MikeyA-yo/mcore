// ──────────────────────────────────────────────────────────────
// MeterCore Domain Types
// Pure value objects and enums — no dependencies on infrastructure
// ──────────────────────────────────────────────────────────────

// ─── Enums ───────────────────────────────────────────────────

export enum QualificationState {
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT',
  DEMOTED = 'DEMOTED',
}

export enum DatasetType {
  GOLD = 'GOLD',
  ROLLING = 'ROLLING',
  FAILURE = 'FAILURE',
}

export enum AdaptationMethod {
  SFT = 'simulated-sft',
  DPO = 'simulated-dpo',
  GRPO = 'simulated-grpo',
  LORA = 'simulated-lora',
  QLORA = 'simulated-qlora',
}

// ─── Model ───────────────────────────────────────────────────

export interface Model {
  id: string;
  name: string;
  provider: string;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  quality: number; // 0–1 (e.g. 0.997 = 99.7%)
  latencyMs: number;
  failureProbability: number; // 0–1
  contextWindow: number;
  supportedModalities: string[];
  adaptationPotential: number; // 0–1, how much quality could improve with fine-tuning
  tags: string[];
}

// ─── Execution Configuration ─────────────────────────────────

export interface ExecutionConfiguration {
  id: string;
  modelId: string;
  workflowId: string;
  promptVersion: string;
  runtimeParameters: Record<string, unknown>;
  quality: number;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  latencyMs: number;
  failureProbability: number;
  state: QualificationState;
  parentConfigId?: string;
  adaptationMethod?: AdaptationMethod;
  adaptationDatasetId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Capability Contract ─────────────────────────────────────

export interface CapabilityContract {
  workflowId: string;
  minimumQuality: number;
  maximumP95LatencyMs: number;
  maximumCriticalFailures: number;
  allowedProviders: string[];
  requiredModalities: string[];
}

// ─── Workflow ────────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  contract: CapabilityContract;
}

// ─── Datasets ────────────────────────────────────────────────

export interface DatasetCase {
  id: string;
  input: string;
  expectedOutcome: string;
  critical: boolean;
  metadata?: Record<string, unknown>;
}

export interface Dataset {
  id: string;
  name: string;
  type: DatasetType;
  version: string;
  workflowId: string;
  cases: DatasetCase[];
  createdAt: string;
}

// ─── Evaluation ──────────────────────────────────────────────

export interface EvaluationCaseResult {
  caseId: string;
  configId: string;
  success: boolean;
  isCritical: boolean;
  criticalFailure: boolean;
  quality: number;
  latencyMs: number;
  estimatedCost: number;
}

export interface EvaluationRun {
  id: string;
  configId: string;
  datasetId: string;
  datasetVersion: string;
  evaluatorVersion: string;
  results: EvaluationCaseResult[];
  aggregateQuality: number;
  criticalFailures: number;
  p95LatencyMs: number;
  meanCostPerCase: number;
  totalCost: number;
  successRate: number;
  timestamp: string;
}

// ─── Evidence ────────────────────────────────────────────────

export interface QualificationEvidence {
  id: string;
  configId: string;
  workflowId: string;
  workflowVersion: string;
  datasetId: string;
  datasetVersion: string;
  evaluatorVersion: string;
  runs: number;
  quality: number;
  qualityStdDev: number;
  confidenceInterval: { lower: number; upper: number };
  criticalFailures: number;
  p95LatencyMs: number;
  costPerSuccessfulCase: number;
  decision: 'PROMOTE' | 'REJECT' | 'DEMOTE';
  fromState: QualificationState;
  toState: QualificationState;
  reason: string;
  timestamp: string;
  expiresAt: string;
}

// ─── State Transition ────────────────────────────────────────

export interface StateTransition {
  id: string;
  configId: string;
  fromState: QualificationState;
  toState: QualificationState;
  evidenceId?: string;
  timestamp: string;
  reason: string;
}

// ─── Input Analysis ──────────────────────────────────────────

export interface InputAnalysis {
  filePath?: string;
  type: 'text' | 'image' | 'mixed';
  characters?: number;
  words?: number;
  estimatedTokens: number;
  imageUnits?: number;
  dimensions?: { width: number; height: number };
  fileSizeBytes?: number;
  warnings: string[];
}

// ─── Cost Estimation ─────────────────────────────────────────

export interface CostEstimate {
  configId: string;
  configName?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

// ─── Traces ──────────────────────────────────────────────────

export interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  parentEventId?: string;
  durationMs?: number;
}

export interface Trace {
  id: string;
  workflowId: string;
  events: TraceEvent[];
  startTime: string;
  endTime?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

// ─── Runtime Policy ──────────────────────────────────────────

export interface RuntimePolicy {
  id: string;
  workflowId: string;
  primary: string;
  fallback: string[];
  policyVersion: number;
  createdAt: string;
  expiresAt: string;
}

// ─── Adaptation ──────────────────────────────────────────────

export interface AdaptationResult {
  originalConfigId: string;
  newConfigId: string;
  method: AdaptationMethod;
  datasetId: string;
  qualityBefore: number;
  qualityAfter: number;
  costBefore: number;
  costAfter: number;
  latencyBefore: number;
  latencyAfter: number;
}

// ─── Allocation ──────────────────────────────────────────────

export interface AllocationDecision {
  id: string;
  workflowId: string;
  selectedConfigId: string;
  reason: string;
  candidateConfigs: Array<{
    configId: string;
    state: QualificationState;
    quality: number;
    costPerCase: number;
    latencyMs: number;
  }>;
  policy: RuntimePolicy;
  timestamp: string;
}

// ─── Optimization Result (full loop output) ──────────────────

export interface OptimizationResult {
  traceId: string;
  workflowId: string;
  inputAnalysis: InputAnalysis;
  costEstimates: CostEstimate[];
  incumbentConfig: ExecutionConfiguration;
  candidateEvaluations: Array<{
    configId: string;
    qualified: boolean;
    reason: string;
    evidence?: QualificationEvidence;
  }>;
  adaptations: AdaptationResult[];
  allocation?: AllocationDecision;
  estimatedSavings: {
    incumbentCost: number;
    optimizedCost: number;
    savingsPercent: number;
    savingsAbsolute: number;
  };
}

// ─── Shadow Simulation ───────────────────────────────────────

export interface ShadowSimulationResult {
  id: string;
  configId: string;
  incumbentConfigId: string;
  workflowId: string;
  totalRequests: number;
  candidateQuality: number;
  incumbentQuality: number;
  candidateMeanLatencyMs: number;
  incumbentMeanLatencyMs: number;
  candidateCostPerCase: number;
  incumbentCostPerCase: number;
  criticalFailures: number;
  qualified: boolean;
  promotedToHot: boolean;
  reason: string;
  timestamp: string;
}

// ─── Canary Simulation ───────────────────────────────────────

export interface CanaryStepResult {
  trafficPercent: number;
  requestsRouted: number;
  candidateSuccessRate: number;
  incumbentSuccessRate: number;
  candidateLatencyP95: number;
  candidateFailures: number;
  passed: boolean;
}

export interface CanarySimulationResult {
  id: string;
  configId: string;
  incumbentConfigId: string;
  workflowId: string;
  totalRequests: number;
  steps: CanaryStepResult[];
  overallSuccessRate: number;
  estimatedCost: number;
  status: 'PASSED' | 'ROLLED_BACK';
  reason: string;
  timestamp: string;
}

