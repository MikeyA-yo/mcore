// ──────────────────────────────────────────────────────────────
// Optimization Loop Service
//
// Core business logic for the optimization loop:
// Measure → Generate Candidates → Qualify → Adapt → Allocate → Observe
// Shared by both CLI (`meter optimize`) and REST API (`POST /api/optimize`)
// ──────────────────────────────────────────────────────────────

import { Container, TOKENS } from '../container.js';
import type {
  IInputAnalyzer,
  ICostEngine,
  IQualificationService,
  IAllocator,
  IAdaptationEngine,
  ITraceStore,
  IStorageAdapter,
} from '../ports/index.js';
import type {
  ExecutionConfiguration,
  Workflow,
  Dataset,
  OptimizationResult,
  QualificationEvidence,
  AdaptationResult,
  AllocationDecision,
} from '../domain/types.js';
import {
  QualificationState,
  AdaptationMethod,
  DatasetType,
} from '../domain/types.js';

function perCaseCost(config: ExecutionConfiguration): number {
  return (
    (5_000 / 1_000_000) * config.inputCostPerMillionTokens +
    (1_000 / 1_000_000) * config.outputCostPerMillionTokens
  );
}

export async function executeOptimizationLoop(
  container: Container,
  params: {
    input: string;
    isText?: boolean;
    workflowId?: string;
  },
): Promise<OptimizationResult> {
  const workflowId = params.workflowId || 'refund-resolution';

  const analyzer = container.get<IInputAnalyzer>(TOKENS.InputAnalyzer);
  const costEngine = container.get<ICostEngine>(TOKENS.CostEngine);
  const qualService = container.get<IQualificationService>(TOKENS.QualificationService);
  const allocator = container.get<IAllocator>(TOKENS.Allocator);
  const adaptEngine = container.get<IAdaptationEngine>(TOKENS.AdaptationEngine);
  const traceStore = container.get<ITraceStore>(TOKENS.TraceStore);
  const storage = container.get<IStorageAdapter>(TOKENS.StorageAdapter);

  // 1. Start trace
  const trace = await traceStore.startTrace(workflowId);

  try {
    // 2. Input Analysis
    const analysis = params.isText
      ? await analyzer.analyzeText(params.input)
      : await analyzer.analyzeFile(params.input);

    const outputTokens = Math.ceil(analysis.estimatedTokens * 0.3);

    await traceStore.addEvent(trace.id, {
      type: 'INPUT_ANALYSIS',
      timestamp: new Date().toISOString(),
      data: {
        type: analysis.type,
        estimatedTokens: analysis.estimatedTokens,
        outputTokens,
        characters: analysis.characters,
        words: analysis.words,
      },
    });

    // 3. Workflow & configs
    const workflow = await storage.read<Workflow>('workflows', workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const allConfigs = await storage.query<ExecutionConfiguration>(
      'configurations',
      (c) => c.workflowId === workflowId,
    );

    // 4. Cost estimation
    const estimates = await costEngine.estimateAll(
      allConfigs,
      analysis.estimatedTokens,
      outputTokens,
    );

    await traceStore.addEvent(trace.id, {
      type: 'COST_ESTIMATION',
      timestamp: new Date().toISOString(),
      data: Object.fromEntries(
        estimates.map((e) => [e.configId, `$${e.totalCost.toFixed(6)}`]),
      ),
    });

    // 5. Discover incumbent & candidates
    const incumbent = allConfigs.find((c) => c.state === QualificationState.HOT) || allConfigs[0];
    const incumbentCost = perCaseCost(incumbent);

    const candidates = allConfigs.filter(
      (c) => c.state === QualificationState.COLD && perCaseCost(c) < incumbentCost,
    );

    const candidateEvaluations: Array<{
      configId: string;
      qualified: boolean;
      reason: string;
      evidence?: QualificationEvidence;
    }> = [];

    const adaptations: AdaptationResult[] = [];

    // 6. Qualify and adapt candidates
    for (const candidate of candidates) {
      const evidence = await qualService.qualify(candidate.id, workflowId);

      await traceStore.addEvent(trace.id, {
        type: 'CANDIDATE_EVALUATION',
        timestamp: new Date().toISOString(),
        data: {
          configId: candidate.id,
          decision: evidence.decision,
          quality: evidence.quality,
          confidenceInterval: evidence.confidenceInterval,
          criticalFailures: evidence.criticalFailures,
        },
      });

      if (evidence.decision === 'PROMOTE') {
        candidateEvaluations.push({
          configId: candidate.id,
          qualified: true,
          reason: evidence.reason,
          evidence,
        });

        // Offline passed, check WARM -> HOT promotion
        const updated = await storage.read<ExecutionConfiguration>('configurations', candidate.id);
        if (updated?.state === QualificationState.WARM) {
          const shadowEvidence = await qualService.qualify(candidate.id, workflowId);
          await traceStore.addEvent(trace.id, {
            type: 'SHADOW_QUALIFICATION',
            timestamp: new Date().toISOString(),
            data: {
              configId: candidate.id,
              decision: shadowEvidence.decision,
              quality: shadowEvidence.quality,
              fromState: shadowEvidence.fromState,
              toState: shadowEvidence.toState,
            },
          });
        }
      } else {
        candidateEvaluations.push({
          configId: candidate.id,
          qualified: false,
          reason: evidence.reason,
          evidence,
        });

        // Attempt simulated TRL adaptation if possible
        if (adaptEngine.canAdapt(candidate)) {
          const datasets = await storage.query<Dataset>(
            'datasets',
            (d) => d.workflowId === workflowId && d.type === DatasetType.GOLD,
          );
          const goldDs = datasets[0];

          if (goldDs) {
            const adaptation = await adaptEngine.adapt(
              candidate,
              AdaptationMethod.SFT,
              goldDs.id,
            );
            adaptations.push(adaptation);

            await traceStore.addEvent(trace.id, {
              type: 'POST_TRAINING_SIMULATION',
              timestamp: new Date().toISOString(),
              data: {
                originalConfigId: adaptation.originalConfigId,
                newConfigId: adaptation.newConfigId,
                method: AdaptationMethod.SFT,
                qualityBefore: adaptation.qualityBefore,
                qualityAfter: adaptation.qualityAfter,
              },
            });

            // Qualify the adapted configuration
            const adaptedEvidence = await qualService.qualify(
              adaptation.newConfigId,
              workflowId,
            );

            if (adaptedEvidence.decision === 'PROMOTE') {
              candidateEvaluations.push({
                configId: adaptation.newConfigId,
                qualified: true,
                reason: adaptedEvidence.reason,
                evidence: adaptedEvidence,
              });

              // Shadow promotion WARM -> HOT
              const warmConfig = await storage.read<ExecutionConfiguration>(
                'configurations',
                adaptation.newConfigId,
              );
              if (warmConfig?.state === QualificationState.WARM) {
                const shadowEv = await qualService.qualify(adaptation.newConfigId, workflowId);
                if (shadowEv.decision === 'PROMOTE') {
                  await traceStore.addEvent(trace.id, {
                    type: 'SHADOW_QUALIFICATION',
                    timestamp: new Date().toISOString(),
                    data: {
                      configId: adaptation.newConfigId,
                      decision: shadowEv.decision,
                      quality: shadowEv.quality,
                      fromState: shadowEv.fromState,
                      toState: shadowEv.toState,
                    },
                  });
                }
              }
            } else {
              candidateEvaluations.push({
                configId: adaptation.newConfigId,
                qualified: false,
                reason: adaptedEvidence.reason,
                evidence: adaptedEvidence,
              });
            }
          }
        }
      }
    }

    // 7. Allocation
    let allocation: AllocationDecision | undefined;
    try {
      allocation = await allocator.allocate(workflowId);
      await traceStore.addEvent(trace.id, {
        type: 'ALLOCATION',
        timestamp: new Date().toISOString(),
        data: {
          selectedConfigId: allocation.selectedConfigId,
          fallback: allocation.policy.fallback,
          reason: allocation.reason,
        },
      });
    } catch {
      // No HOT configurations available
    }

    // 8. Savings summary
    const selectedConfig = allocation
      ? await storage.read<ExecutionConfiguration>('configurations', allocation.selectedConfigId)
      : null;

    const optimizedCost = selectedConfig ? perCaseCost(selectedConfig) : incumbentCost;
    const savingsAbsolute = Math.max(0, incumbentCost - optimizedCost);
    const savingsPercent = incumbentCost > 0 ? (savingsAbsolute / incumbentCost) * 100 : 0;

    if (savingsAbsolute > 0) {
      await traceStore.addEvent(trace.id, {
        type: 'SAVINGS_ESTIMATE',
        timestamp: new Date().toISOString(),
        data: {
          incumbentCost,
          optimizedCost,
          savingsPercent,
          savingsAbsolute,
        },
      });
    }

    await traceStore.endTrace(trace.id, 'COMPLETED');

    return {
      traceId: trace.id,
      workflowId,
      inputAnalysis: analysis,
      costEstimates: estimates,
      incumbentConfig: incumbent,
      candidateEvaluations,
      adaptations,
      allocation,
      estimatedSavings: {
        incumbentCost: Math.round(incumbentCost * 10000) / 10000,
        optimizedCost: Math.round(optimizedCost * 10000) / 10000,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        savingsAbsolute: Math.round(savingsAbsolute * 10000) / 10000,
      },
    };
  } catch (err) {
    await traceStore.endTrace(trace.id, 'FAILED');
    throw err;
  }
}
