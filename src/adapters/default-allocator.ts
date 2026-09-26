// ──────────────────────────────────────────────────────────────
// Default Allocator Adapter
//
// Port: IAllocator
// Selects the cheapest HOT configuration that satisfies
// the workflow's capability contract.
//
// Replaceable with: LLMRouter, weighted routing, A/B framework
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import type { IAllocator, IStorageAdapter } from '../ports/index.js';
import type {
  ExecutionConfiguration,
  Workflow,
  AllocationDecision,
  RuntimePolicy,
} from '../domain/types.js';
import { QualificationState } from '../domain/types.js';

// Assume a "reference case" of 5 000 input + 1 000 output tokens
// for per-case cost comparison.
const REF_INPUT_TOKENS = 5_000;
const REF_OUTPUT_TOKENS = 1_000;

function perCaseCost(config: ExecutionConfiguration): number {
  return (
    (REF_INPUT_TOKENS / 1_000_000) * config.inputCostPerMillionTokens +
    (REF_OUTPUT_TOKENS / 1_000_000) * config.outputCostPerMillionTokens
  );
}

export class DefaultAllocator implements IAllocator {
  constructor(private readonly storage: IStorageAdapter) {}

  async allocate(workflowId: string): Promise<AllocationDecision> {
    const workflow = await this.storage.read<Workflow>(
      'workflows',
      workflowId,
    );
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    // Get all HOT configs for this workflow
    const hotConfigs = await this.storage.query<ExecutionConfiguration>(
      'configurations',
      (c) =>
        c.workflowId === workflowId &&
        c.state === QualificationState.HOT,
    );

    if (hotConfigs.length === 0) {
      throw new Error(
        `No HOT configurations available for workflow: ${workflowId}`,
      );
    }

    const contract = workflow.contract;

    // Filter to those that satisfy the contract
    const qualifying = hotConfigs.filter(
      (c) =>
        c.quality >= contract.minimumQuality &&
        c.latencyMs <= contract.maximumP95LatencyMs,
    );

    // Sort cheapest first
    const sorted = (qualifying.length > 0 ? qualifying : hotConfigs).sort(
      (a, b) => perCaseCost(a) - perCaseCost(b),
    );

    const selected = sorted[0];
    const fallbacks = hotConfigs
      .filter((c) => c.id !== selected.id)
      .sort((a, b) => a.quality - b.quality) // highest quality first for fallback
      .reverse()
      .map((c) => c.id);

    // Build runtime policy
    const policy: RuntimePolicy = {
      id: `pol_${nanoid(8)}`,
      workflowId,
      primary: selected.id,
      fallback: fallbacks,
      policyVersion: Date.now(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    await this.storage.write('policies', policy.id, policy);

    const decision: AllocationDecision = {
      id: `alloc_${nanoid(8)}`,
      workflowId,
      selectedConfigId: selected.id,
      reason: qualifying.length > 0
        ? 'Selected cheapest qualifying HOT configuration'
        : 'No qualifying HOT configs — selected cheapest HOT as best-effort',
      candidateConfigs: hotConfigs.map((c) => ({
        configId: c.id,
        state: c.state,
        quality: c.quality,
        costPerCase: perCaseCost(c),
        latencyMs: c.latencyMs,
      })),
      policy,
      timestamp: new Date().toISOString(),
    };
    await this.storage.write('allocations', decision.id, decision);

    return decision;
  }

  async getCurrentPolicy(
    workflowId: string,
  ): Promise<RuntimePolicy | null> {
    const policies = await this.storage.query<RuntimePolicy>(
      'policies',
      (p) => p.workflowId === workflowId,
    );
    if (policies.length === 0) return null;

    return policies.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }
}
