// ──────────────────────────────────────────────────────────────
// Seed Data
//
// Pre-built models, workflow, configurations, and datasets
// matching the PRD's "Refund Resolution" demo scenario.
//
// Cost rates are calibrated so that a reference case of
// 5 000 input + 1 000 output tokens produces the PRD's
// per-case costs ($0.080, $0.055, $0.012, $0.006).
// ──────────────────────────────────────────────────────────────

import type {
  Model,
  Workflow,
  ExecutionConfiguration,
  Dataset,
} from '../domain/types.js';
import {
  QualificationState,
  DatasetType,
} from '../domain/types.js';

// ─── Models ──────────────────────────────────────────────────

export const SEED_MODELS: Model[] = [
  {
    id: 'frontier-x',
    name: 'Frontier-X',
    provider: 'provider-a',
    inputCostPerMillionTokens: 10.0,
    outputCostPerMillionTokens: 30.0,
    quality: 0.997,
    latencyMs: 800,
    failureProbability: 0.003,
    contextWindow: 128_000,
    supportedModalities: ['text', 'image'],
    adaptationPotential: 0.002,
    tags: ['frontier', 'general-purpose'],
  },
  {
    id: 'frontier-y',
    name: 'Frontier-Y',
    provider: 'provider-b',
    inputCostPerMillionTokens: 7.0,
    outputCostPerMillionTokens: 20.0,
    quality: 0.994,
    latencyMs: 600,
    failureProbability: 0.005,
    contextWindow: 128_000,
    supportedModalities: ['text', 'image'],
    adaptationPotential: 0.005,
    tags: ['frontier', 'efficient'],
  },
  {
    id: 'small-x',
    name: 'Small-X',
    provider: 'provider-a',
    inputCostPerMillionTokens: 1.5,
    outputCostPerMillionTokens: 4.5,
    quality: 0.968,
    latencyMs: 300,
    failureProbability: 0.02,
    contextWindow: 32_000,
    supportedModalities: ['text'],
    adaptationPotential: 0.035,
    tags: ['small', 'fast'],
  },
  {
    id: 'local-x',
    name: 'Local-X',
    provider: 'local',
    inputCostPerMillionTokens: 0.8,
    outputCostPerMillionTokens: 2.0,
    quality: 0.942,
    latencyMs: 180,
    failureProbability: 0.04,
    contextWindow: 8_000,
    supportedModalities: ['text'],
    adaptationPotential: 0.045,
    tags: ['local', 'open-source'],
  },
];

// ─── Workflow ────────────────────────────────────────────────

export const SEED_WORKFLOW: Workflow = {
  id: 'refund-resolution',
  name: 'Refund Resolution',
  description:
    'Automated analysis and resolution of customer refund requests, including duplicate charge detection, policy validation, and outcome determination.',
  currentVersion: 'v2',
  contract: {
    workflowId: 'refund-resolution',
    minimumQuality: 0.99,
    maximumP95LatencyMs: 5000,
    maximumCriticalFailures: 0,
    allowedProviders: ['provider-a', 'provider-b', 'local'],
    requiredModalities: ['text'],
  },
};

// ─── Execution Configurations ────────────────────────────────

export const SEED_CONFIGURATIONS: ExecutionConfiguration[] = [
  {
    id: 'frontier-x-default',
    modelId: 'frontier-x',
    workflowId: 'refund-resolution',
    promptVersion: 'refund-v2',
    runtimeParameters: {},
    quality: 0.997,
    inputCostPerMillionTokens: 10.0,
    outputCostPerMillionTokens: 30.0,
    latencyMs: 800,
    failureProbability: 0.003,
    state: QualificationState.HOT,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'frontier-y-default',
    modelId: 'frontier-y',
    workflowId: 'refund-resolution',
    promptVersion: 'refund-v2',
    runtimeParameters: {},
    quality: 0.994,
    inputCostPerMillionTokens: 7.0,
    outputCostPerMillionTokens: 20.0,
    latencyMs: 600,
    failureProbability: 0.005,
    state: QualificationState.COLD,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'small-x-default',
    modelId: 'small-x',
    workflowId: 'refund-resolution',
    promptVersion: 'refund-v2',
    runtimeParameters: {},
    quality: 0.968,
    inputCostPerMillionTokens: 1.5,
    outputCostPerMillionTokens: 4.5,
    latencyMs: 300,
    failureProbability: 0.02,
    state: QualificationState.COLD,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'local-x-default',
    modelId: 'local-x',
    workflowId: 'refund-resolution',
    promptVersion: 'refund-v2',
    runtimeParameters: {},
    quality: 0.942,
    inputCostPerMillionTokens: 0.8,
    outputCostPerMillionTokens: 2.0,
    latencyMs: 180,
    failureProbability: 0.04,
    state: QualificationState.COLD,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

// ─── Datasets ────────────────────────────────────────────────

export const SEED_DATASETS: Dataset[] = [
  {
    id: 'gold-v1',
    name: 'Refund Gold Dataset',
    type: DatasetType.GOLD,
    version: 'v1',
    workflowId: 'refund-resolution',
    createdAt: '2026-09-01T00:00:00Z',
    cases: [
      { id: 'g01', input: 'Customer was charged twice for order #4821. They want a refund for the duplicate.', expectedOutcome: 'refund_duplicate_charge', critical: true },
      { id: 'g02', input: 'Received wrong item. Ordered blue shirt size M, received red shirt size L.', expectedOutcome: 'refund_wrong_item', critical: false },
      { id: 'g03', input: 'Package never arrived. Tracking shows delivered but customer says not received.', expectedOutcome: 'investigate_delivery', critical: true },
      { id: 'g04', input: 'Customer wants to return an opened electronics item purchased 45 days ago.', expectedOutcome: 'deny_outside_return_window', critical: false },
      { id: 'g05', input: 'Subscription auto-renewed after customer claims they cancelled. Charged $49.99.', expectedOutcome: 'refund_subscription', critical: true },
      { id: 'g06', input: 'Item arrived damaged. Photos show cracked screen on laptop.', expectedOutcome: 'refund_damaged_item', critical: false },
      { id: 'g07', input: 'Customer disputes a charge they do not recognize on their statement.', expectedOutcome: 'investigate_unrecognized_charge', critical: true },
      { id: 'g08', input: 'Promotional discount was not applied at checkout. Customer paid full price.', expectedOutcome: 'partial_refund_promo', critical: false },
      { id: 'g09', input: 'Customer received an empty box. Claims the item was missing from the package.', expectedOutcome: 'refund_missing_item', critical: true },
      { id: 'g10', input: 'Service outage caused customer to miss a deadline. Requesting compensation.', expectedOutcome: 'service_credit', critical: false },
      { id: 'g11', input: 'Customer was charged sales tax in a tax-exempt jurisdiction.', expectedOutcome: 'refund_tax_error', critical: false },
      { id: 'g12', input: 'Bulk order of 500 units received with 23 defective items.', expectedOutcome: 'partial_refund_defective', critical: false },
      { id: 'g13', input: 'Customer alleges product caused property damage. Requesting full refund plus damages.', expectedOutcome: 'escalate_to_legal', critical: true },
      { id: 'g14', input: 'Digital download link expired before customer could access the content.', expectedOutcome: 'reissue_download', critical: false },
      { id: 'g15', input: 'Customer placed order under wrong account. Wants to transfer to correct account.', expectedOutcome: 'transfer_order', critical: false },
      { id: 'g16', input: 'Warranty claim for a product that failed 2 months after purchase. 1 year warranty.', expectedOutcome: 'warranty_replacement', critical: false },
      { id: 'g17', input: 'Customer was charged in USD instead of EUR. Exchange rate caused overpayment.', expectedOutcome: 'refund_currency_difference', critical: false },
      { id: 'g18', input: 'Gift card balance shows $0 but customer says it was never used.', expectedOutcome: 'investigate_gift_card', critical: true },
      { id: 'g19', input: 'Customer wants a price match — found the same item cheaper at a competitor.', expectedOutcome: 'deny_price_match', critical: false },
      { id: 'g20', input: 'Same customer submitting 5th refund request this month. Pattern looks suspicious.', expectedOutcome: 'flag_fraud_review', critical: true },
    ],
  },
  {
    id: 'failure-v1',
    name: 'Refund Failure/Edge Cases',
    type: DatasetType.FAILURE,
    version: 'v1',
    workflowId: 'refund-resolution',
    createdAt: '2026-09-01T00:00:00Z',
    cases: [
      { id: 'f01', input: '', expectedOutcome: 'reject_empty_input', critical: true },
      { id: 'f02', input: 'asdkjhasdkjhaskjdh random gibberish 12381923 !@#$%', expectedOutcome: 'reject_unintelligible', critical: true },
      { id: 'f03', input: 'I want a refund because the product made my cat sick and I am going to sue you for $10 million dollars and also I want to speak to the CEO immediately.', expectedOutcome: 'escalate_to_legal', critical: true },
      { id: 'f04', input: 'Refund please. '.repeat(500), expectedOutcome: 'reject_spam', critical: true },
      { id: 'f05', input: 'Customer reports that the AI assistant told them they would receive a full refund, but no refund was authorized by a human agent.', expectedOutcome: 'escalate_ai_promise', critical: true },
    ],
  },
];
