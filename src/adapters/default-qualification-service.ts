// ──────────────────────────────────────────────────────────────
// Default Qualification Service Adapter
//
// Port: IQualificationService
// Implements the COLD → WARM → HOT → DEMOTED lifecycle.
// Uses repeated evaluation + simple-statistics for confidence
// intervals to produce promotion/rejection evidence.
//
// Replaceable with: durable workflow (Temporal), policy engine (OPA)
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import { mean, standardDeviation } from 'simple-statistics';
import type {
  IQualificationService,
  IEvaluationEngine,
  IEvidenceStore,
  IStorageAdapter,
} from '../ports/index.js';
import type {
  QualificationEvidence,
  StateTransition,
  ExecutionConfiguration,
  Workflow,
  Dataset,
} from '../domain/types.js';
import { QualificationState, DatasetType } from '../domain/types.js';

const EVALUATION_RUNS = 10;

export class DefaultQualificationService implements IQualificationService {
  constructor(
    private readonly evaluationEngine: IEvaluationEngine,
    private readonly evidenceStore: IEvidenceStore,
    private readonly storage: IStorageAdapter,
  ) {}

  async qualify(
    configId: string,
    workflowId: string,
  ): Promise<QualificationEvidence> {
    const config = await this.storage.read<ExecutionConfiguration>(
      'configurations',
      configId,
    );
    if (!config) throw new Error(`Configuration not found: ${configId}`);

    const workflow = await this.storage.read<Workflow>(
      'workflows',
      workflowId,
    );
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    // Select datasets
    const datasets = await this.storage.query<Dataset>(
      'datasets',
      (d) => d.workflowId === workflowId,
    );
    const goldDataset = datasets.find((d) => d.type === DatasetType.GOLD);
    if (!goldDataset) {
      throw new Error(`No GOLD dataset found for workflow: ${workflowId}`);
    }

    // Run repeated evaluations
    const runs = await this.evaluationEngine.evaluateRepeated(
      config,
      goldDataset,
      EVALUATION_RUNS,
    );

    // Compute statistics
    const qualities = runs.map((r) => r.aggregateQuality);
    const qualityMean = mean(qualities);
    const qualityStdDev =
      qualities.length > 1 ? standardDeviation(qualities) : 0;

    // 95% confidence interval
    const marginOfError =
      1.96 * (qualityStdDev / Math.sqrt(runs.length));
    const confidenceInterval = {
      lower: qualityMean - marginOfError,
      upper: qualityMean + marginOfError,
    };

    const totalCriticalFailures = runs.reduce(
      (sum, r) => sum + r.criticalFailures,
      0,
    );
    const p95Latencies = runs.map((r) => r.p95LatencyMs);
    const maxP95Latency = Math.max(...p95Latencies);
    const avgCostPerCase = mean(runs.map((r) => r.meanCostPerCase));

    // Check against capability contract
    const contract = workflow.contract;
    const meetsQuality = confidenceInterval.lower >= contract.minimumQuality;
    const meetsLatency = maxP95Latency <= contract.maximumP95LatencyMs;
    const meetsCritical =
      totalCriticalFailures <= contract.maximumCriticalFailures;
    const qualifies = meetsQuality && meetsLatency && meetsCritical;

    // Determine state transition
    const fromState = config.state;
    let toState: QualificationState;
    let decision: 'PROMOTE' | 'REJECT';

    if (qualifies) {
      decision = 'PROMOTE';
      toState =
        fromState === QualificationState.COLD
          ? QualificationState.WARM
          : fromState === QualificationState.WARM
            ? QualificationState.HOT
            : fromState; // Already HOT — re-confirm
    } else {
      decision = 'REJECT';
      toState = fromState;
    }

    // Build reason
    let reason: string;
    if (qualifies) {
      reason = [
        'Candidate satisfies all capability constraints.',
        `Quality: ${(qualityMean * 100).toFixed(2)}%`,
        `CI: [${(confidenceInterval.lower * 100).toFixed(2)}%–${(confidenceInterval.upper * 100).toFixed(2)}%]`,
        `P95 Latency: ${maxP95Latency.toFixed(0)} ms`,
        `Critical failures: ${totalCriticalFailures}`,
      ].join(' ');
    } else {
      const violations: string[] = [];
      if (!meetsQuality)
        violations.push(
          `Quality CI lower ${(confidenceInterval.lower * 100).toFixed(2)}% < ${(contract.minimumQuality * 100).toFixed(2)}% required`,
        );
      if (!meetsLatency)
        violations.push(
          `P95 Latency ${maxP95Latency.toFixed(0)} ms > ${contract.maximumP95LatencyMs} ms max`,
        );
      if (!meetsCritical)
        violations.push(
          `Critical failures ${totalCriticalFailures} > ${contract.maximumCriticalFailures} max`,
        );
      reason = `Does not satisfy capability contract. ${violations.join('; ')}`;
    }

    const evidence: QualificationEvidence = {
      id: `evi_${nanoid(8)}`,
      configId,
      workflowId,
      workflowVersion: workflow.currentVersion,
      datasetId: goldDataset.id,
      datasetVersion: goldDataset.version,
      evaluatorVersion: 'simulated-v1',
      runs: runs.length,
      quality: qualityMean,
      qualityStdDev,
      confidenceInterval,
      criticalFailures: totalCriticalFailures,
      p95LatencyMs: maxP95Latency,
      costPerSuccessfulCase: avgCostPerCase,
      decision,
      fromState,
      toState,
      reason,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 7-day expiry
    };

    await this.evidenceStore.store(evidence);

    // Apply promotion if earned
    if (decision === 'PROMOTE' && toState !== fromState) {
      await this.promote(configId, evidence);
    }

    return evidence;
  }

  async canPromote(
    configId: string,
    _workflowId: string,
  ): Promise<{ canPromote: boolean; reason: string }> {
    const latest = await this.evidenceStore.getLatest(configId);
    if (!latest)
      return { canPromote: false, reason: 'No qualification evidence found' };
    if (latest.decision !== 'PROMOTE')
      return {
        canPromote: false,
        reason: `Last evaluation result: ${latest.decision}`,
      };
    if (new Date(latest.expiresAt) < new Date())
      return { canPromote: false, reason: 'Evidence has expired' };
    return { canPromote: true, reason: 'Valid promotion evidence exists' };
  }

  async promote(
    configId: string,
    evidence: QualificationEvidence,
  ): Promise<StateTransition> {
    const config = await this.storage.read<ExecutionConfiguration>(
      'configurations',
      configId,
    );
    if (!config) throw new Error(`Configuration not found: ${configId}`);

    const transition: StateTransition = {
      id: `trn_${nanoid(8)}`,
      configId,
      fromState: config.state,
      toState: evidence.toState,
      evidenceId: evidence.id,
      timestamp: new Date().toISOString(),
      reason: evidence.reason,
    };

    // Update config state
    config.state = evidence.toState;
    config.updatedAt = new Date().toISOString();
    await this.storage.write('configurations', configId, config);

    // Persist transition
    await this.storage.write('transitions', transition.id, transition);

    return transition;
  }

  async demote(configId: string, reason: string): Promise<StateTransition> {
    const config = await this.storage.read<ExecutionConfiguration>(
      'configurations',
      configId,
    );
    if (!config) throw new Error(`Configuration not found: ${configId}`);

    const fromState = config.state;
    const transition: StateTransition = {
      id: `trn_${nanoid(8)}`,
      configId,
      fromState,
      toState: QualificationState.DEMOTED,
      timestamp: new Date().toISOString(),
      reason,
    };

    // Update config state
    config.state = QualificationState.DEMOTED;
    config.updatedAt = new Date().toISOString();
    await this.storage.write('configurations', configId, config);

    // Persist transition
    await this.storage.write('transitions', transition.id, transition);

    // Store demotion evidence
    const evidence: QualificationEvidence = {
      id: `evi_${nanoid(8)}`,
      configId,
      workflowId: config.workflowId,
      workflowVersion: '',
      datasetId: '',
      datasetVersion: '',
      evaluatorVersion: 'system',
      runs: 0,
      quality: config.quality,
      qualityStdDev: 0,
      confidenceInterval: { lower: 0, upper: 0 },
      criticalFailures: 0,
      p95LatencyMs: 0,
      costPerSuccessfulCase: 0,
      decision: 'DEMOTE',
      fromState,
      toState: QualificationState.DEMOTED,
      reason,
      timestamp: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    await this.evidenceStore.store(evidence);

    return transition;
  }
}
