// ──────────────────────────────────────────────────────────────
// meter simulate-degradation <configId>
// Simulates quality drop → demotion → fallback
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type {
  IQualificationService,
  IAllocator,
  IStorageAdapter,
  ITraceStore,
} from '../ports/index.js';
import type {
  ExecutionConfiguration,
  Workflow,
} from '../domain/types.js';
import { QualificationState } from '../domain/types.js';

export function registerSimulateDegradationCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('simulate-degradation <configId>')
    .description(
      'Simulate quality degradation, trigger demotion, and show fallback',
    )
    .option(
      '--quality <value>',
      'Degraded quality value (0–1)',
      '0.984',
    )
    .action(async (configId: string, opts: { quality: string }) => {
      try {
        const storage = container.get<IStorageAdapter>(
          TOKENS.StorageAdapter,
        );
        const qualService = container.get<IQualificationService>(
          TOKENS.QualificationService,
        );
        const allocator = container.get<IAllocator>(TOKENS.Allocator);
        const traceStore = container.get<ITraceStore>(TOKENS.TraceStore);

        const config = await storage.read<ExecutionConfiguration>(
          'configurations',
          configId,
        );
        if (!config) {
          console.error(
            chalk.red(`✗ Configuration not found: ${configId}`),
          );
          process.exitCode = 1;
          return;
        }

        if (config.state !== QualificationState.HOT) {
          console.error(
            chalk.red(
              `✗ Configuration ${configId} is ${config.state}, not HOT. Only HOT configs can be degraded.`,
            ),
          );
          process.exitCode = 1;
          return;
        }

        const workflow = await storage.read<Workflow>(
          'workflows',
          config.workflowId,
        );
        if (!workflow) {
          console.error(
            chalk.red(`✗ Workflow not found: ${config.workflowId}`),
          );
          process.exitCode = 1;
          return;
        }

        const degradedQuality = parseFloat(opts.quality);
        const originalQuality = config.quality;

        console.log();
        console.log(
          chalk.bold.cyan('💥 Simulating Degradation'),
        );
        console.log(chalk.dim('─'.repeat(60)));

        // Step 1: Show degradation
        console.log(
          `  ${chalk.bold(configId)} quality: ${chalk.green((originalQuality * 100).toFixed(1) + '%')} → ${chalk.red((degradedQuality * 100).toFixed(1) + '%')}`,
        );
        console.log(
          `  Contract minimum: ${chalk.yellow((workflow.contract.minimumQuality * 100).toFixed(1) + '%')}`,
        );

        // Step 2: Apply degradation
        config.quality = degradedQuality;
        config.updatedAt = new Date().toISOString();
        await storage.write('configurations', configId, config);

        // Step 3: Check contract violation
        const violates = degradedQuality < workflow.contract.minimumQuality;
        console.log();

        if (violates) {
          console.log(
            chalk.red.bold('  ✗ CONTRACT VIOLATION DETECTED'),
          );
          console.log(
            chalk.dim(
              `    ${(degradedQuality * 100).toFixed(1)}% < ${(workflow.contract.minimumQuality * 100).toFixed(1)}% minimum`,
            ),
          );

          // Step 4: Demote
          const trace = await traceStore.startTrace(config.workflowId);
          await traceStore.addEvent(trace.id, {
            type: 'DEGRADATION_DETECTED',
            timestamp: new Date().toISOString(),
            data: {
              configId,
              originalQuality,
              degradedQuality,
              contractMinimum: workflow.contract.minimumQuality,
            },
          });

          const transition = await qualService.demote(
            configId,
            `Quality degraded from ${(originalQuality * 100).toFixed(1)}% to ${(degradedQuality * 100).toFixed(1)}%, below contract minimum ${(workflow.contract.minimumQuality * 100).toFixed(1)}%`,
          );

          console.log();
          console.log(
            chalk.red(
              `  ↓ ${transition.fromState} → ${transition.toState}`,
            ),
          );
          console.log(chalk.dim(`    Reason: ${transition.reason}`));

          await traceStore.addEvent(trace.id, {
            type: 'DEMOTION',
            timestamp: new Date().toISOString(),
            data: {
              configId,
              fromState: transition.fromState,
              toState: transition.toState,
              reason: transition.reason,
            },
          });

          // Step 5: Attempt fallback allocation
          console.log();
          console.log(chalk.bold('  Selecting fallback...'));

          try {
            const allocation = await allocator.allocate(
              config.workflowId,
            );
            console.log(
              chalk.green.bold(
                `  ✓ Fallback: ${allocation.selectedConfigId}`,
              ),
            );

            const fallbackConfig =
              await storage.read<ExecutionConfiguration>(
                'configurations',
                allocation.selectedConfigId,
              );
            if (fallbackConfig) {
              const fbTable = new Table({
                style: { head: ['cyan'] },
              });
              fbTable.push(
                { Config: fallbackConfig.id },
                { Model: fallbackConfig.modelId },
                { State: chalk.green(fallbackConfig.state) },
                {
                  Quality: `${(fallbackConfig.quality * 100).toFixed(1)}%`,
                },
                {
                  Latency: `${fallbackConfig.latencyMs} ms`,
                },
              );
              console.log(fbTable.toString());
            }

            await traceStore.addEvent(trace.id, {
              type: 'FALLBACK_ALLOCATION',
              timestamp: new Date().toISOString(),
              data: {
                selectedConfigId: allocation.selectedConfigId,
                policy: allocation.policy,
              },
            });
          } catch {
            console.log(
              chalk.red(
                '  ✗ No fallback available — no other HOT configurations',
              ),
            );
          }

          await traceStore.endTrace(trace.id, 'COMPLETED');
          console.log();
          console.log(
            chalk.dim(`  Trace: ${trace.id}`),
          );
        } else {
          console.log(
            chalk.yellow(
              '  ⚠ Quality degraded but still within contract bounds.',
            ),
          );
          // Restore original quality
          config.quality = originalQuality;
          await storage.write('configurations', configId, config);
        }

        console.log();
      } catch (err) {
        console.error(
          chalk.red('✗ Degradation simulation failed:'),
          err,
        );
        process.exitCode = 1;
      }
    });
}
