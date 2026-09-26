// ──────────────────────────────────────────────────────────────
// MeterCore Dashboard API Client
// Talks to the Hono REST API backend via /api (proxied to :3001)
// ──────────────────────────────────────────────────────────────

const API_BASE = '/api';

export interface OverviewMetrics {
  workflowsCount: number;
  configurationsCount: number;
  stateCounts: {
    HOT: number;
    WARM: number;
    COLD: number;
    DEMOTED: number;
  };
  baselineCost: number;
  optimizedCost: number;
  savingsPercent: number;
  totalTracesCount: number;
  totalEvidenceCount: number;
  activePolicy: {
    id: string;
    workflowId: string;
    primary: string;
    fallback: string[];
    policyVersion: number;
    expiresAt: string;
  } | null;
  latestTrace: any | null;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  quality: number;
  latencyMs: number;
  failureProbability: number;
  contextWindow: number;
  supportedModalities: string[];
  adaptationPotential: number;
  tags: string[];
}

export interface ExecutionConfiguration {
  id: string;
  modelId: string;
  workflowId: string;
  promptVersion: string;
  quality: number;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  latencyMs: number;
  failureProbability: number;
  state: 'COLD' | 'WARM' | 'HOT' | 'DEMOTED';
  parentConfigId?: string;
  adaptationMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
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
  fromState: string;
  toState: string;
  reason: string;
  timestamp: string;
  expiresAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  contract: {
    workflowId: string;
    minimumQuality: number;
    maximumP95LatencyMs: number;
    maximumCriticalFailures: number;
    allowedProviders: string[];
    requiredModalities: string[];
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  getOverview: () => request<OverviewMetrics>('/overview'),
  getModels: () => request<Model[]>('/models'),
  getConfigurations: (workflowId?: string, state?: string) => {
    const params = new URLSearchParams();
    if (workflowId) params.append('workflowId', workflowId);
    if (state) params.append('state', state);
    const qs = params.toString();
    return request<ExecutionConfiguration[]>(`/configurations${qs ? `?${qs}` : ''}`);
  },
  getConfiguration: (id: string) => request<ExecutionConfiguration>(`/configurations/${id}`),
  getWorkflows: () => request<Workflow[]>('/workflows'),
  getDatasets: () => request<any[]>('/datasets'),
  getTraces: (limit = 30) => request<Trace[]>(`/traces?limit=${limit}`),
  getTrace: (id: string) => request<Trace>(`/traces/${id}`),
  getEvidence: (configId?: string) => {
    const qs = configId ? `?configId=${encodeURIComponent(configId)}` : '';
    return request<QualificationEvidence[]>(`/evidence${qs}`);
  },
  getEvidenceById: (id: string) => request<QualificationEvidence>(`/evidence/${id}`),

  // Actions
  optimize: (input: string, isText = true, workflowId = 'refund-resolution') =>
    request<any>('/optimize', {
      method: 'POST',
      body: JSON.stringify({ input, isText, workflowId }),
    }),

  shadowTest: (candidateConfigId: string, workflowId = 'refund-resolution', requestsCount = 100) =>
    request<any>('/shadow', {
      method: 'POST',
      body: JSON.stringify({ candidateConfigId, workflowId, requestsCount }),
    }),

  canaryTest: (candidateConfigId: string, workflowId = 'refund-resolution', totalRequests = 1000) =>
    request<any>('/canary', {
      method: 'POST',
      body: JSON.stringify({ candidateConfigId, workflowId, totalRequests }),
    }),

  qualify: (configId: string, workflowId = 'refund-resolution') =>
    request<any>('/qualify', {
      method: 'POST',
      body: JSON.stringify({ configId, workflowId }),
    }),

  demote: (configId: string, reason?: string) =>
    request<any>(`/configurations/${configId}/demote`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  simulateDegradation: (configId: string, degradedQuality = 0.982, workflowId = 'refund-resolution') =>
    request<any>('/simulate-degradation', {
      method: 'POST',
      body: JSON.stringify({ configId, degradedQuality, workflowId }),
    }),

  initData: () =>
    request<{ success: boolean; message: string }>('/init', {
      method: 'POST',
      body: JSON.stringify({ force: true }),
    }),
};
