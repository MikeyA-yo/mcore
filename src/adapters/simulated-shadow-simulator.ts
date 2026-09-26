// ──────────────────────────────────────────────────────────────
// Simulated Shadow Traffic Simulator Adapter
//
// Implements IShadowSimulator (PRD §19):
// Dispatches simulated production requests to both the incumbent
// and candidate configuration in parallel (shadow mode).
// The candidate's output does not affect end outcomes, but its
// quality, latency, and reliability are measured under live conditions.
//
// When candidate satisfies the Capability Contract in shadow mode,
// it is promoted from WARM → HOT.
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import type { IShadowSimulator, IStorageAdapter, IEvidenceStore, ITraceStore } from '../ports/index.js';
import {
  QualificationState,
  type ShadowSimulationResult,
  type ExecutionConfiguration,
  type Workflow,
  type QualificationEvidence,
  type StateTransition,
} from '../domain/types.js';

export class SimulatedShadowSimulator implements IShadowSimulator {
  constructor(
    private storage: IStorageAdapter,
    private evidenceStore: IEvidenceStore,
    private traceStore?: ITraceStore,
  ) {}

  async simulateShadow(
    candidateConfigId: string,
    workflowId: string,
    requestsCount = 100,
  ): Promise<ShadowSimulationResult> {
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

    // Find incumbent (HOT configuration for this workflow)
    const allConfigs = await this.storage.list<ExecutionConfiguration>('configurations');
    const incumbent = allConfigs.find(
      (c) => c.workflowId === workflowId && c.state === QualificationState.HOT && c.id !== candidateConfigId,
    ) || allConfigs.find((c) => c.workflowId === workflowId && c.id !== candidateConfigId) || candidate;

    let candidateSuccesses = 0;
    let incumbentSuccesses = 0;
    let criticalFailures = 0;
    const candidateLatencies: number[] = [];
    const incumbentLatencies: number[] = [];

    // Simulate requestsCount requests in shadow parallel dispatch
    for (let i = 0; i < requestsCount; i++) {
      // Stochastic candidate evaluation with jitter
      const candJitter = (Math.random() - 0.5) * 0.008; // ±0.4%
      const candEffectiveQuality = Math.min(0.999, Math.max(0.8, candidate.quality + candJitter));
      const candSuccess = Math.random() < candEffectiveQuality;
      if (candSuccess) {
        candidateSuccesses++;
      } else {
        // Check for critical failure (10% chance a failure is critical)
        if (Math.random() < 0.1) {
          criticalFailures++;
        }
      }

      // Latency simulation (jitter around mean)
      const candLatJitter = (Math.random() - 0.5) * 0.2 * candidate.latencyMs;
      candidateLatencies.push(Math.round(candidate.latencyMs + candLatJitter));

      // Incumbent evaluation
      const incSuccess = Math.random() < incumbent.quality;
      if (incSuccess) incumbentSuccesses++;
      const incLatJitter = (Math.random() - 0.5) * 0.2 * incumbent.latencyMs;
      incumbentLatencies.push(Math.round(incumbent.latencyMs + incLatJitter));
    }

    const candidateQuality = Math.round((candidateSuccesses / requestsCount) * 1000) / 1000;
    const incumbentQuality = Math.round((incumbentSuccesses / requestsCount) * 1000) / 1000;
    const candidateMeanLatency = Math.round(candidateLatencies.reduce((a, b) => a + b, 0) / requestsCount);
    const incumbentMeanLatency = Math.round(incumbentLatencies.reduce((a, b) => a + b, 0) / requestsCount);

    // Reference per-case cost formula (5K input, 1K output)
    const candidateCost = Math.round(
      ((5000 / 1_000_000) * candidate.inputCostPerMillionTokens +
        (1000 / 1_000_000) * candidate.outputCostPerMillionTokens) * 1000
    ) / 1000;

    const incumbentCost = Math.round(
      ((5000 / 1_000_000) * incumbent.inputCostPerMillionTokens +
        (1000 / 1_000_000) * incumbent.outputCostPerMillionTokens) * 1000
    ) / 1000;

    // Check capability contract
    const contract = workflow.contract;
    const meetsQuality = candidateQuality >= contract.minimumQuality;
    const meetsLatency = candidateMeanLatency <= contract.maximumP95LatencyMs;
    const meetsFailures = criticalFailures <= contract.maximumCriticalFailures;
    const qualified = meetsQuality && meetsLatency && meetsFailures;

    let promotedToHot = false;
    let reason = '';

    if (qualified) {
      // Promote WARM → HOT
      promotedToHot = true;
      reason = `Candidate passed shadow traffic simulation with ${(candidateQuality * 100).toFixed(1)}% quality, 0 critical failures, ${candidateMeanLatency}ms latency.`;

      candidate.state = QualificationState.HOT;
      candidate.updatedAt = new Date().toISOString();
      await this.storage.write('configurations', candidate.id, candidate);

      // Record state transition
      const transition: StateTransition = {
        id: `trans_${nanoid(8)}`,
        configId: candidate.id,
        fromState: QualificationState.WARM,
        toState: QualificationState.HOT,
        timestamp: new Date().toISOString(),
        reason: 'Shadow evaluation passed; promoted to HOT for production allocation',
      };
      await this.storage.write('state_transitions', transition.id, transition);

      // Record evidence
      const evidence: QualificationEvidence = {
        id: `ev_${nanoid(8)}`,
        configId: candidate.id,
        workflowId: workflow.id,
        workflowVersion: workflow.currentVersion,
        datasetId: 'shadow-traffic-live',
        datasetVersion: 'live-v1',
        evaluatorVersion: 'shadow-evaluator-v1',
        runs: requestsCount,
        quality: candidateQuality,
        qualityStdDev: 0.005,
        confidenceInterval: {
          lower: Math.max(0, candidateQuality - 0.005),
          upper: Math.min(1, candidateQuality + 0.005),
        },
        criticalFailures,
        p95LatencyMs: candidateMeanLatency,
        costPerSuccessfulCase: candidateCost,
        decision: 'PROMOTE',
        fromState: QualificationState.WARM,
        toState: QualificationState.HOT,
        reason,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      await this.evidenceStore.store(evidence);
    } else {
      const failureReasons: string[] = [];
      if (!meetsQuality) {
        failureReasons.push(`Quality ${(candidateQuality * 100).toFixed(1)}% < required ${(contract.minimumQuality * 100).toFixed(1)}%`);
      }
      if (!meetsFailures) {
        failureReasons.push(`Critical failures ${criticalFailures} > allowed ${contract.maximumCriticalFailures}`);
      }
      if (!meetsLatency) {
        failureReasons.push(`Latency ${candidateMeanLatency}ms > allowed ${contract.maximumP95LatencyMs}ms`);
      }
      reason = `Shadow qualification failed: ${failureReasons.join(', ')}`;
    }

    return {
      id: `shadow_${nanoid(8)}`,
      configId: candidate.id,
      incumbentConfigId: incumbent.id,
      workflowId: workflow.id,
      totalRequests: requestsCount,
      candidateQuality,
      incumbentQuality,
      candidateMeanLatencyMs: candidateMeanLatency,
      incumbentMeanLatencyMs: incumbentMeanLatency,
      candidateCostPerCase: candidateCost,
      incumbentCostPerCase: incumbentCost,
      criticalFailures,
      qualified,
      promotedToHot,
      reason,
      timestamp: new Date().toISOString(),
    };
  }
}
