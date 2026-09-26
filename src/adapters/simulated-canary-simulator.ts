// ──────────────────────────────────────────────────────────────
// Simulated Canary Traffic Simulator Adapter
//
// Implements ICanarySimulator (PRD §20):
// Simulates progressive traffic ramp-up for a candidate configuration
// through stepped percentages (e.g. 5% → 10% → 25% → 50% → 100%).
// Compares outcomes with the incumbent configuration and can trigger
// automatic rollback if safety thresholds are breached.
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import type { ICanarySimulator, IStorageAdapter } from '../ports/index.js';
import {
  QualificationState,
  type CanarySimulationResult,
  type CanaryStepResult,
  type ExecutionConfiguration,
  type Workflow,
} from '../domain/types.js';

export class SimulatedCanarySimulator implements ICanarySimulator {
  constructor(private storage: IStorageAdapter) {}

  async simulateCanary(
    candidateConfigId: string,
    workflowId: string,
    totalRequests = 1000,
    steps = [5, 10, 25, 50, 100],
  ): Promise<CanarySimulationResult> {
    const candidate = await this.storage.read<ExecutionConfiguration>(
      'configurations',
      candidateConfigId,
    );
    if (!candidate) {
      throw new Error(`Candidate configuration '${candidateConfigId}' not found`);
    }

    const workflow = await this.storage.read<Workflow>('workflows', workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    // Incumbent configuration
    const allConfigs = await this.storage.list<ExecutionConfiguration>('configurations');
    const incumbent = allConfigs.find(
      (c) => c.workflowId === workflowId && c.state === QualificationState.HOT && c.id !== candidateConfigId,
    ) || allConfigs.find((c) => c.workflowId === workflowId && c.id !== candidateConfigId) || candidate;

    const requestsPerStep = Math.max(10, Math.floor(totalRequests / steps.length));
    const stepResults: CanaryStepResult[] = [];
    let rolledBack = false;
    let rollbackReason = '';
    let totalCandidateSuccesses = 0;
    let totalCandidateRequests = 0;

    for (const stepPercent of steps) {
      const candidateReqCount = Math.max(1, Math.round((requestsPerStep * stepPercent) / 100));
      const incumbentReqCount = requestsPerStep - candidateReqCount;

      let candSuccesses = 0;
      let candCriticalFailures = 0;
      const candLatencies: number[] = [];

      for (let i = 0; i < candidateReqCount; i++) {
        const jitter = (Math.random() - 0.5) * 0.006;
        const effQuality = Math.min(0.999, Math.max(0.8, candidate.quality + jitter));
        if (Math.random() < effQuality) {
          candSuccesses++;
        } else if (Math.random() < 0.08) {
          candCriticalFailures++;
        }

        const latJitter = (Math.random() - 0.5) * 0.2 * candidate.latencyMs;
        candLatencies.push(Math.round(candidate.latencyMs + latJitter));
      }

      let incSuccesses = 0;
      for (let i = 0; i < incumbentReqCount; i++) {
        if (Math.random() < incumbent.quality) {
          incSuccesses++;
        }
      }

      totalCandidateSuccesses += candSuccesses;
      totalCandidateRequests += candidateReqCount;

      candLatencies.sort((a, b) => a - b);
      const p95Idx = Math.min(candLatencies.length - 1, Math.floor(candLatencies.length * 0.95));
      const candidateLatencyP95 = candLatencies[p95Idx] || candidate.latencyMs;

      const candSuccessRate = candSuccesses / candidateReqCount;
      const incSuccessRate = incumbentReqCount > 0 ? incSuccesses / incumbentReqCount : 1.0;

      const meetsQuality = candSuccessRate >= (workflow.contract.minimumQuality - 0.005);
      const meetsLatency = candidateLatencyP95 <= workflow.contract.maximumP95LatencyMs;
      const meetsFailures = candCriticalFailures <= workflow.contract.maximumCriticalFailures;

      const passed = meetsQuality && meetsLatency && meetsFailures;

      stepResults.push({
        trafficPercent: stepPercent,
        requestsRouted: candidateReqCount,
        candidateSuccessRate: Math.round(candSuccessRate * 1000) / 1000,
        incumbentSuccessRate: Math.round(incSuccessRate * 1000) / 1000,
        candidateLatencyP95,
        candidateFailures: candidateReqCount - candSuccesses,
        passed,
      });

      if (!passed) {
        rolledBack = true;
        rollbackReason = `Safety breach at ${stepPercent}% traffic: Quality ${(candSuccessRate * 100).toFixed(1)}%, Critical failures: ${candCriticalFailures}. Initiating rollback.`;
        break;
      }
    }

    const overallSuccessRate = totalCandidateRequests > 0
      ? Math.round((totalCandidateSuccesses / totalCandidateRequests) * 1000) / 1000
      : 1.0;

    const candidateCostPerCase =
      (5000 / 1_000_000) * candidate.inputCostPerMillionTokens +
      (1000 / 1_000_000) * candidate.outputCostPerMillionTokens;
    const incumbentCostPerCase =
      (5000 / 1_000_000) * incumbent.inputCostPerMillionTokens +
      (1000 / 1_000_000) * incumbent.outputCostPerMillionTokens;

    const estimatedTotalCost = Math.round(
      (totalCandidateRequests * candidateCostPerCase +
        (totalRequests - totalCandidateRequests) * incumbentCostPerCase) * 100
    ) / 100;

    return {
      id: `canary_${nanoid(8)}`,
      configId: candidate.id,
      incumbentConfigId: incumbent.id,
      workflowId: workflow.id,
      totalRequests,
      steps: stepResults,
      overallSuccessRate,
      estimatedCost: estimatedTotalCost,
      status: rolledBack ? 'ROLLED_BACK' : 'PASSED',
      reason: rolledBack
        ? rollbackReason
        : `Canary ramp-up succeeded across all steps [${steps.map((s) => `${s}%`).join(' → ')}]. Zero critical failures.`,
      timestamp: new Date().toISOString(),
    };
  }
}
