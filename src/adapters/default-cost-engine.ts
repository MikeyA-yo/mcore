// ──────────────────────────────────────────────────────────────
// Default Cost Engine Adapter
//
// Port: ICostEngine
// Formula: (tokens / 1,000,000) × pricePerMillionTokens
// Replaceable with: provider-specific billing APIs
// ──────────────────────────────────────────────────────────────

import type { ICostEngine } from '../ports/index.js';
import type { ExecutionConfiguration, CostEstimate } from '../domain/types.js';

export class DefaultCostEngine implements ICostEngine {
  async estimate(
    config: ExecutionConfiguration,
    inputTokens: number,
    outputTokens: number,
  ): Promise<CostEstimate> {
    const inputCost =
      (inputTokens / 1_000_000) * config.inputCostPerMillionTokens;
    const outputCost =
      (outputTokens / 1_000_000) * config.outputCostPerMillionTokens;

    return {
      configId: config.id,
      modelId: config.modelId,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  async estimateAll(
    configs: ExecutionConfiguration[],
    inputTokens: number,
    outputTokens: number,
  ): Promise<CostEstimate[]> {
    return Promise.all(
      configs.map((c) => this.estimate(c, inputTokens, outputTokens)),
    );
  }
}
