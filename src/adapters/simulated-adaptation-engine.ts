// ──────────────────────────────────────────────────────────────
// Simulated Adaptation Engine Adapter
//
// Port: IAdaptationEngine
// Models post-training / fine-tuning as a quality improvement
// operation without actually running training.
//
// Replaceable with: TRL, Axolotl, real fine-tuning pipelines
// ──────────────────────────────────────────────────────────────

import type {
  IAdaptationEngine,
  IModelRegistry,
  IStorageAdapter,
} from '../ports/index.js';
import type {
  ExecutionConfiguration,
  AdaptationResult,
  AdaptationMethod,
} from '../domain/types.js';
import { QualificationState } from '../domain/types.js';

export class SimulatedAdaptationEngine implements IAdaptationEngine {
  constructor(
    private readonly storage: IStorageAdapter,
    private readonly modelRegistry: IModelRegistry,
  ) {}

  canAdapt(config: ExecutionConfiguration): boolean {
    // In simulation mode every config can be adapted
    return true;
  }

  async adapt(
    config: ExecutionConfiguration,
    method: AdaptationMethod,
    datasetId: string,
  ): Promise<AdaptationResult> {
    const model = await this.modelRegistry.getById(config.modelId);
    if (!model) {
      throw new Error(`Model not found: ${config.modelId}`);
    }

    // Calculate improvement based on model's adaptation potential
    // Higher potential → larger quality gain
    const potential = model.adaptationPotential;
    const qualityGain = potential * (0.6 + Math.random() * 0.4); // 60–100% of potential
    const costOverhead = config.inputCostPerMillionTokens * 0.15; // ~15% adapter overhead
    const latencyOverhead = 10 + Math.random() * 25; // 10–35 ms adapter latency

    const newQuality = Math.min(1, config.quality + qualityGain);
    const newInputCost = config.inputCostPerMillionTokens + costOverhead;
    const newOutputCost =
      config.outputCostPerMillionTokens + costOverhead * 2;
    const newLatency = config.latencyMs + latencyOverhead;

    // Build adapted configuration
    const shortMethod = method.replace('simulated-', '');
    const newConfig: ExecutionConfiguration = {
      id: `${config.modelId}-${shortMethod}-adapted`,
      modelId: config.modelId,
      workflowId: config.workflowId,
      promptVersion: config.promptVersion,
      runtimeParameters: {
        ...config.runtimeParameters,
        adapter: method,
        baseConfig: config.id,
      },
      quality: newQuality,
      inputCostPerMillionTokens: newInputCost,
      outputCostPerMillionTokens: newOutputCost,
      latencyMs: newLatency,
      failureProbability: config.failureProbability * 0.75, // Adapter reduces failures
      state: QualificationState.COLD,
      parentConfigId: config.id,
      adaptationMethod: method,
      adaptationDatasetId: datasetId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.write('configurations', newConfig.id, newConfig);

    return {
      originalConfigId: config.id,
      newConfigId: newConfig.id,
      method,
      datasetId,
      qualityBefore: config.quality,
      qualityAfter: newQuality,
      costBefore: config.inputCostPerMillionTokens,
      costAfter: newInputCost,
      latencyBefore: config.latencyMs,
      latencyAfter: newLatency,
    };
  }
}
