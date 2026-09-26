// ──────────────────────────────────────────────────────────────
// meter optimize <input>
//
// The full optimisation loop from the PRD:
// Measure → Generate Candidates → Qualify → Adapt → Allocate → Observe
//
// This is the primary demo command.
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type {
  IInputAnalyzer,
  ICostEngine,
  IEvaluationEngine,
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
  CostEstimate,
} from '../domain/types.js';
import {
  QualificationState,
  AdaptationMethod,
  DatasetType,
} from '../domain/types.js';

/** Per-case cost using the reference case (5K in + 1K out tokens). */
function perCaseCost(config: ExecutionConfiguration): number {
  return (
    (5_000 / 1_000_000) * config.inputCostPerMillionTokens +
    (1_000 / 1_000_000) * config.outputCostPerMillionTokens
  );
}

export function registerOptimizeCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('optimize <input>')
    .description(
      'Run the full cost-optimisation loop: analyse → candidates → qualify → adapt → allocate',
    )
    .option('--text', 'Treat <input> as raw text instead of a file path')
    .option(
      '-w, --workflow <id>',
      'Workflow ID',
      'refund-resolution',
    )
    .action(
      async (
        input: string,
        opts: { text?: boolean; workflow: string },
      ) => {
        try {
          const analyzer = container.get<IInputAnalyzer>(
            TOKENS.InputAnalyzer,
          );
          const costEngine = container.get<ICostEngine>(TOKENS.CostEngine);
          const qualService = container.get<IQualificationService>(
            TOKENS.QualificationService,
          );
          const allocator = container.get<IAllocator>(TOKENS.Allocator);
          const adaptEngine = container.get<IAdaptationEngine>(
            TOKENS.AdaptationEngine,
          );
          const traceStore = container.get<ITraceStore>(TOKENS.TraceStore);
          const storage = container.get<IStorageAdapter>(
            TOKENS.StorageAdapter,
          );

          // ─── Start trace ─────────────────────────────────
          const trace = await traceStore.startTrace(opts.workflow);

          console.log();
          console.log(
            chalk.bold.cyan(
              '🚀 MeterCore Optimisation Loop',
            ),
          );
          console.log(chalk.dim('═'.repeat(60)));

          // ─── Step 1: Input analysis ──────────────────────
          console.log();
          console.log(chalk.bold('Step 1 — Input Analysis'));
          console.log(chalk.dim('─'.repeat(40)));

          const analysis = opts.text
            ? await analyzer.analyzeText(input)
            : await analyzer.analyzeFile(input);

          const outputTokens = Math.ceil(
            analysis.estimatedTokens * 0.3,
          );

          console.log(
            `  Type:   ${analysis.type}`,
          );
          console.log(
            `  Tokens: ${chalk.bold(analysis.estimatedTokens.toLocaleString())} input, ${outputTokens.toLocaleString()} output (est.)`,
          );

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

          // ─── Step 2: Get workflow & configs ──────────────
          const workflow = await storage.read<Workflow>(
            'workflows',
            opts.workflow,
          );
          if (!workflow) {
            console.error(
              chalk.red(`  ✗ Workflow not found: ${opts.workflow}`),
            );
            await traceStore.endTrace(trace.id, 'FAILED');
            process.exitCode = 1;
            return;
          }

          const allConfigs =
            await storage.query<ExecutionConfiguration>(
              'configurations',
              (c) => c.workflowId === opts.workflow,
            );

          // ─── Step 3: Cost estimation ─────────────────────
          console.log();
          console.log(chalk.bold('Step 2 — Cost Estimation'));
          console.log(chalk.dim('─'.repeat(40)));

          const estimates = await costEngine.estimateAll(
            allConfigs,
            analysis.estimatedTokens,
            outputTokens,
          );

          const costTable = new Table({
            head: ['Configuration', 'State', 'Cost', 'Quality'],
            style: { head: ['cyan'] },
          });

          for (const est of estimates.sort(
            (a, b) => a.totalCost - b.totalCost,
          )) {
            const cfg = allConfigs.find(
              (c) => c.id === est.configId,
            )!;
            const stateColor =
              cfg.state === QualificationState.HOT
                ? chalk.green
                : cfg.state === QualificationState.WARM
                  ? chalk.yellow
                  : cfg.state === QualificationState.DEMOTED
                    ? chalk.red
                    : chalk.blue;
            costTable.push([
              cfg.id,
              stateColor(cfg.state),
              `$${est.totalCost.toFixed(6)}`,
              `${(cfg.quality * 100).toFixed(1)}%`,
            ]);
          }
          console.log(costTable.toString());

          await traceStore.addEvent(trace.id, {
            type: 'COST_ESTIMATION',
            timestamp: new Date().toISOString(),
            data: Object.fromEntries(
              estimates.map((e) => [e.configId, `$${e.totalCost.toFixed(6)}`]),
            ),
          });

          // ─── Step 4: Identify incumbent & candidates ─────
          console.log();
          console.log(
            chalk.bold('Step 3 — Candidate Discovery'),
          );
          console.log(chalk.dim('─'.repeat(40)));

          const incumbent = allConfigs.find(
            (c) => c.state === QualificationState.HOT,
          );
          if (!incumbent) {
            console.log(
              chalk.yellow(
                '  No HOT incumbent — all configurations are candidates',
              ),
            );
          } else {
            console.log(
              `  Incumbent: ${chalk.green(incumbent.id)} ($${perCaseCost(incumbent).toFixed(4)}/case)`,
            );
          }

          const incumbentCost = incumbent
            ? perCaseCost(incumbent)
            : Infinity;

          // Candidates = COLD configs cheaper than incumbent
          const candidates = allConfigs.filter(
            (c) =>
              c.state === QualificationState.COLD &&
              perCaseCost(c) < incumbentCost,
          );

          if (candidates.length === 0) {
            console.log(
              chalk.dim('  No cheaper candidates available.'),
            );
          } else {
            for (const c of candidates) {
              console.log(
                `  Candidate: ${chalk.blue(c.id)} ($${perCaseCost(c).toFixed(4)}/case)`,
              );
            }
          }

          // ─── Step 5: Qualify candidates ──────────────────
          console.log();
          console.log(
            chalk.bold('Step 4 — Qualification'),
          );
          console.log(chalk.dim('─'.repeat(40)));

          let bestNewHot: ExecutionConfiguration | null = null;

          for (const candidate of candidates) {
            console.log(
              chalk.dim(`  Qualifying ${candidate.id}...`),
            );
            const evidence = await qualService.qualify(
              candidate.id,
              opts.workflow,
            );

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
              console.log(
                chalk.green(
                  `  ✓ ${candidate.id}: PROMOTE (${evidence.fromState} → ${evidence.toState}) — quality ${(evidence.quality * 100).toFixed(2)}%`,
                ),
              );

              // Re-read config to get updated state
              const updated =
                await storage.read<ExecutionConfiguration>(
                  'configurations',
                  candidate.id,
                );
              if (
                updated?.state === QualificationState.WARM ||
                updated?.state === QualificationState.HOT
              ) {
                // Qualify again to move WARM → HOT
                if (updated.state === QualificationState.WARM) {
                  console.log(
                    chalk.dim(
                      `  Running shadow qualification for ${candidate.id}...`,
                    ),
                  );
                  const shadowEvidence = await qualService.qualify(
                    candidate.id,
                    opts.workflow,
                  );

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

                  if (shadowEvidence.decision === 'PROMOTE') {
                    console.log(
                      chalk.green(
                        `  ✓ ${candidate.id}: PROMOTE (${shadowEvidence.fromState} → ${shadowEvidence.toState})`,
                      ),
                    );
                    const hotConfig =
                      await storage.read<ExecutionConfiguration>(
                        'configurations',
                        candidate.id,
                      );
                    if (
                      hotConfig?.state === QualificationState.HOT
                    ) {
                      bestNewHot = hotConfig;
                    }
                  }
                } else {
                  bestNewHot = updated;
                }
              }
            } else {
              console.log(
                chalk.red(
                  `  ✗ ${candidate.id}: REJECT — ${evidence.reason}`,
                ),
              );

              // ─── Step 5b: Attempt adaptation ─────────────
              if (adaptEngine.canAdapt(candidate)) {
                console.log(
                  chalk.dim(
                    `  Attempting simulated TRL adaptation for ${candidate.id}...`,
                  ),
                );

                const datasets =
                  await storage.query<Dataset>(
                    'datasets',
                    (d) =>
                      d.workflowId === opts.workflow &&
                      d.type === DatasetType.GOLD,
                  );
                const goldDs = datasets[0];
                if (!goldDs) continue;

                const adaptation = await adaptEngine.adapt(
                  candidate,
                  AdaptationMethod.SFT,
                  goldDs.id,
                );

                console.log(
                  chalk.cyan(
                    `  → Adapted: ${adaptation.newConfigId}`,
                  ),
                );
                console.log(
                  chalk.dim(
                    `    Quality: ${(adaptation.qualityBefore * 100).toFixed(1)}% → ${(adaptation.qualityAfter * 100).toFixed(1)}%`,
                  ),
                );
                console.log(
                  chalk.dim(
                    `    Cost:    $${adaptation.costBefore.toFixed(2)}/M → $${adaptation.costAfter.toFixed(2)}/M`,
                  ),
                );
                console.log(
                  chalk.dim(
                    `    Latency: ${adaptation.latencyBefore.toFixed(0)} ms → ${adaptation.latencyAfter.toFixed(0)} ms`,
                  ),
                );

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

                // Qualify the adapted version
                console.log(
                  chalk.dim(
                    `  Qualifying adapted config ${adaptation.newConfigId}...`,
                  ),
                );
                const adaptedEvidence = await qualService.qualify(
                  adaptation.newConfigId,
                  opts.workflow,
                );

                if (adaptedEvidence.decision === 'PROMOTE') {
                  console.log(
                    chalk.green(
                      `  ✓ ${adaptation.newConfigId}: PROMOTE (${adaptedEvidence.fromState} → ${adaptedEvidence.toState})`,
                    ),
                  );

                  // Try WARM → HOT
                  const warmConfig =
                    await storage.read<ExecutionConfiguration>(
                      'configurations',
                      adaptation.newConfigId,
                    );
                  if (
                    warmConfig?.state === QualificationState.WARM
                  ) {
                    console.log(
                      chalk.dim(
                        `  Running shadow qualification for ${adaptation.newConfigId}...`,
                      ),
                    );
                    const shadowEv = await qualService.qualify(
                      adaptation.newConfigId,
                      opts.workflow,
                    );
                    if (shadowEv.decision === 'PROMOTE') {
                      console.log(
                        chalk.green(
                          `  ✓ ${adaptation.newConfigId}: PROMOTE (${shadowEv.fromState} → ${shadowEv.toState})`,
                        ),
                      );
                      const hotCfg =
                        await storage.read<ExecutionConfiguration>(
                          'configurations',
                          adaptation.newConfigId,
                        );
                      if (
                        hotCfg?.state === QualificationState.HOT
                      ) {
                        bestNewHot = hotCfg;
                      }
                    }
                  }
                } else {
                  console.log(
                    chalk.red(
                      `  ✗ ${adaptation.newConfigId}: REJECT — ${adaptedEvidence.reason}`,
                    ),
                  );
                }
              }
            }
          }

          // ─── Step 6: Allocate ────────────────────────────
          console.log();
          console.log(chalk.bold('Step 5 — Allocation'));
          console.log(chalk.dim('─'.repeat(40)));

          try {
            const allocation = await allocator.allocate(opts.workflow);
            const selectedConfig =
              await storage.read<ExecutionConfiguration>(
                'configurations',
                allocation.selectedConfigId,
              );

            console.log(
              chalk.green.bold(
                `  Primary: ${allocation.selectedConfigId}`,
              ),
            );
            if (allocation.policy.fallback.length > 0) {
              console.log(
                chalk.dim(
                  `  Fallback: ${allocation.policy.fallback.join(', ')}`,
                ),
              );
            }

            await traceStore.addEvent(trace.id, {
              type: 'ALLOCATION',
              timestamp: new Date().toISOString(),
              data: {
                selectedConfigId: allocation.selectedConfigId,
                fallback: allocation.policy.fallback,
                reason: allocation.reason,
              },
            });

            // ─── Step 7: Savings summary ─────────────────
            console.log();
            console.log(
              chalk.bold('Step 6 — Estimated Savings'),
            );
            console.log(chalk.dim('─'.repeat(40)));

            const optimizedCost = selectedConfig
              ? perCaseCost(selectedConfig)
              : incumbentCost;

            if (incumbent && optimizedCost < incumbentCost) {
              const savingsPercent =
                ((incumbentCost - optimizedCost) / incumbentCost) *
                100;
              const savingsAbsolute = incumbentCost - optimizedCost;

              const savingsTable = new Table({
                style: { head: ['cyan'] },
              });
              savingsTable.push(
                {
                  Incumbent: `${incumbent.id} ($${incumbentCost.toFixed(4)}/case)`,
                },
                {
                  Optimised: `${allocation.selectedConfigId} ($${optimizedCost.toFixed(4)}/case)`,
                },
                {
                  'Savings/case': chalk.green.bold(
                    `$${savingsAbsolute.toFixed(4)}`,
                  ),
                },
                {
                  'Savings %': chalk.green.bold(
                    `${savingsPercent.toFixed(1)}%`,
                  ),
                },
              );
              console.log(savingsTable.toString());

              // Projected savings at scale
              const casesPerDay = 100;
              console.log(
                chalk.dim(
                  `\n  Projected (${casesPerDay} cases/day):`,
                ),
              );
              console.log(
                chalk.dim(
                  `    Daily:   $${(savingsAbsolute * casesPerDay).toFixed(2)}`,
                ),
              );
              console.log(
                chalk.dim(
                  `    Monthly: $${(savingsAbsolute * casesPerDay * 30).toFixed(2)}`,
                ),
              );

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
            } else {
              console.log(
                chalk.dim(
                  '  Incumbent is already the most cost-effective option.',
                ),
              );
            }
          } catch {
            console.log(
              chalk.yellow(
                '  No HOT configurations available for allocation.',
              ),
            );
          }

          // ─── Finalise trace ──────────────────────────────
          await traceStore.endTrace(trace.id, 'COMPLETED');
          console.log();
          console.log(
            chalk.dim('═'.repeat(60)),
          );
          console.log(
            chalk.bold(`Trace: ${trace.id}`),
            chalk.dim('(run "meter trace ' + trace.id + '" to inspect)'),
          );
          console.log();
        } catch (err) {
          console.error(
            chalk.red('✗ Optimisation failed:'),
            err,
          );
          process.exitCode = 1;
        }
      },
    );
}
