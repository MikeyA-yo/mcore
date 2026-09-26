// ──────────────────────────────────────────────────────────────
// meter qualify <configId> — run qualification against workflow
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type {
  IQualificationService,
  IStorageAdapter,
} from '../ports/index.js';
import type { ExecutionConfiguration, Workflow } from '../domain/types.js';

export function registerQualifyCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('qualify <configId>')
    .description(
      'Qualify a configuration against its workflow capability contract',
    )
    .option(
      '-w, --workflow <id>',
      'Workflow ID (defaults to config\'s workflow)',
    )
    .action(async (configId: string, opts: { workflow?: string }) => {
      try {
        const qualService = container.get<IQualificationService>(
          TOKENS.QualificationService,
        );
        const storage = container.get<IStorageAdapter>(
          TOKENS.StorageAdapter,
        );

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

        const workflowId = opts.workflow ?? config.workflowId;
        const workflow = await storage.read<Workflow>(
          'workflows',
          workflowId,
        );
        if (!workflow) {
          console.error(
            chalk.red(`✗ Workflow not found: ${workflowId}`),
          );
          process.exitCode = 1;
          return;
        }

        console.log();
        console.log(
          chalk.bold.cyan('🏆 Qualification'),
          chalk.dim(`${configId} → ${workflow.name}`),
        );
        console.log(chalk.dim('─'.repeat(60)));
        console.log(
          chalk.dim('  Running repeated evaluation (10 runs)...'),
        );

        const evidence = await qualService.qualify(configId, workflowId);

        // Result header
        const icon = evidence.decision === 'PROMOTE' ? '✓' : '✗';
        const color =
          evidence.decision === 'PROMOTE' ? chalk.green : chalk.red;
        console.log();
        console.log(
          color.bold(`  ${icon} ${evidence.decision}`),
          chalk.dim(`(${evidence.fromState} → ${evidence.toState})`),
        );

        // Evidence details
        const table = new Table({ style: { head: ['cyan'] } });
        table.push(
          { 'Evidence ID': evidence.id },
          { Runs: evidence.runs },
          {
            Quality: `${(evidence.quality * 100).toFixed(2)}% (σ ${(evidence.qualityStdDev * 100).toFixed(3)}%)`,
          },
          {
            '95% CI': `[${(evidence.confidenceInterval.lower * 100).toFixed(2)}% – ${(evidence.confidenceInterval.upper * 100).toFixed(2)}%]`,
          },
          {
            'Critical failures':
              evidence.criticalFailures === 0
                ? chalk.green('0')
                : chalk.red(String(evidence.criticalFailures)),
          },
          { 'P95 latency': `${evidence.p95LatencyMs.toFixed(0)} ms` },
          {
            'Cost/successful case': `$${evidence.costPerSuccessfulCase.toFixed(6)}`,
          },
          { Expires: evidence.expiresAt },
        );
        console.log(table.toString());

        // Contract comparison
        console.log();
        console.log(chalk.bold('  Capability Contract:'));
        const contract = workflow.contract;
        const qMet =
          evidence.confidenceInterval.lower >= contract.minimumQuality;
        const lMet =
          evidence.p95LatencyMs <= contract.maximumP95LatencyMs;
        const cMet =
          evidence.criticalFailures <= contract.maximumCriticalFailures;

        console.log(
          `    ${qMet ? chalk.green('✓') : chalk.red('✗')} Quality ≥ ${(contract.minimumQuality * 100).toFixed(1)}%`,
        );
        console.log(
          `    ${lMet ? chalk.green('✓') : chalk.red('✗')} P95 Latency ≤ ${contract.maximumP95LatencyMs} ms`,
        );
        console.log(
          `    ${cMet ? chalk.green('✓') : chalk.red('✗')} Critical failures ≤ ${contract.maximumCriticalFailures}`,
        );
        console.log();
      } catch (err) {
        console.error(chalk.red('✗ Qualification failed:'), err);
        process.exitCode = 1;
      }
    });
}
