// ──────────────────────────────────────────────────────────────
// Simulated Evaluation Engine Adapter
//
// Port: IEvaluationEngine
// Simulates model evaluation against dataset cases using
// the configuration's quality/failure profiles.
//
// Replaceable with: Promptfoo, DeepEval, custom evaluator
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import type { IEvaluationEngine, ITokenizer } from '../ports/index.js';
import type {
  ExecutionConfiguration,
  Dataset,
  EvaluationRun,
  EvaluationCaseResult,
} from '../domain/types.js';

export class SimulatedEvaluationEngine implements IEvaluationEngine {
  constructor(private readonly tokenizer: ITokenizer) {}

  async evaluate(
    config: ExecutionConfiguration,
    dataset: Dataset,
  ): Promise<EvaluationRun> {
    const results: EvaluationCaseResult[] = [];

    for (const testCase of dataset.cases) {
      const r = Math.random();
      const success = r >= config.failureProbability;
      const criticalFailure = !success && testCase.critical;

      // Quality with stochastic noise (±1.5% around the config's quality)
      const noise = (Math.random() - 0.5) * 0.03;
      const caseQuality = success
        ? Math.max(0, Math.min(1, config.quality + noise))
        : Math.max(0, config.quality * 0.7 + (Math.random() - 0.5) * 0.1);

      // Latency with ±15% jitter
      const latencyJitter = (Math.random() - 0.5) * 0.3;
      const latencyMs = Math.max(
        10,
        config.latencyMs * (1 + latencyJitter),
      );

      // Cost estimation for this case
      const inputTokens = this.tokenizer.estimateTokens(testCase.input);
      const outputTokens = Math.ceil(inputTokens * 0.3); // Output typically shorter
      const estimatedCost =
        (inputTokens / 1_000_000) * config.inputCostPerMillionTokens +
        (outputTokens / 1_000_000) * config.outputCostPerMillionTokens;

      results.push({
        caseId: testCase.id,
        configId: config.id,
        success,
        isCritical: testCase.critical,
        criticalFailure,
        quality: caseQuality,
        latencyMs,
        estimatedCost,
      });
    }

    // Aggregate metrics
    const successResults = results.filter((r) => r.success);
    const aggregateQuality =
      successResults.length > 0
        ? successResults.reduce((sum, r) => sum + r.quality, 0) /
          successResults.length
        : 0;

    const criticalFailures = results.filter((r) => r.criticalFailure).length;

    const sortedLatencies = results
      .map((r) => r.latencyMs)
      .sort((a, b) => a - b);
    const p95Index = Math.min(
      Math.floor(sortedLatencies.length * 0.95),
      sortedLatencies.length - 1,
    );
    const p95LatencyMs = sortedLatencies[p95Index] ?? 0;

    const totalCost = results.reduce((sum, r) => sum + r.estimatedCost, 0);
    const meanCostPerCase = results.length > 0 ? totalCost / results.length : 0;
    const successRate =
      results.length > 0 ? successResults.length / results.length : 0;

    return {
      id: `eval_${nanoid(8)}`,
      configId: config.id,
      datasetId: dataset.id,
      datasetVersion: dataset.version,
      evaluatorVersion: 'simulated-v1',
      results,
      aggregateQuality,
      criticalFailures,
      p95LatencyMs,
      meanCostPerCase,
      totalCost,
      successRate,
      timestamp: new Date().toISOString(),
    };
  }

  async evaluateRepeated(
    config: ExecutionConfiguration,
    dataset: Dataset,
    runs: number,
  ): Promise<EvaluationRun[]> {
    const evaluationRuns: EvaluationRun[] = [];
    for (let i = 0; i < runs; i++) {
      evaluationRuns.push(await this.evaluate(config, dataset));
    }
    return evaluationRuns;
  }
}
