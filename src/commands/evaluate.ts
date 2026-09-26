// ──────────────────────────────────────────────────────────────
// meter evaluate --config <id> --dataset <id>
// Runs one evaluation and prints results
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type {
  IEvaluationEngine,
  IStorageAdapter,
} from '../ports/index.js';
import type { ExecutionConfiguration, Dataset } from '../domain/types.js';

export function registerEvaluateCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('evaluate')
    .description('Evaluate a configuration against a dataset')
    .requiredOption('-c, --config <id>', 'Configuration ID')
    .requiredOption('-d, --dataset <id>', 'Dataset ID')
    .option('-r, --runs <n>', 'Number of evaluation runs', '1')
    .action(
      async (opts: { config: string; dataset: string; runs: string }) => {
        try {
          const engine = container.get<IEvaluationEngine>(
            TOKENS.EvaluationEngine,
          );
          const storage = container.get<IStorageAdapter>(
            TOKENS.StorageAdapter,
          );

          const config = await storage.read<ExecutionConfiguration>(
            'configurations',
            opts.config,
          );
          if (!config) {
            console.error(
              chalk.red(`✗ Configuration not found: ${opts.config}`),
            );
            process.exitCode = 1;
            return;
          }

          const dataset = await storage.read<Dataset>(
            'datasets',
            opts.dataset,
          );
          if (!dataset) {
            console.error(
              chalk.red(`✗ Dataset not found: ${opts.dataset}`),
            );
            process.exitCode = 1;
            return;
          }

          const numRuns = parseInt(opts.runs, 10) || 1;
          console.log();
          console.log(
            chalk.bold.cyan('🧪 Evaluation'),
            chalk.dim(
              `${config.id} vs ${dataset.id} (${numRuns} run${numRuns > 1 ? 's' : ''})`,
            ),
          );
          console.log(chalk.dim('─'.repeat(60)));

          const runs = await engine.evaluateRepeated(
            config,
            dataset,
            numRuns,
          );

          for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            if (numRuns > 1) {
              console.log(chalk.dim(`\n  Run ${i + 1}/${numRuns}`));
            }

            const table = new Table({ style: { head: ['cyan'] } });
            table.push(
              { 'Run ID': run.id },
              {
                Quality: qualityColor(
                  run.aggregateQuality,
                  `${(run.aggregateQuality * 100).toFixed(2)}%`,
                ),
              },
              {
                'Success rate': `${(run.successRate * 100).toFixed(1)}%`,
              },
              {
                'Critical failures':
                  run.criticalFailures === 0
                    ? chalk.green('0')
                    : chalk.red(String(run.criticalFailures)),
              },
              {
                'P95 latency': `${run.p95LatencyMs.toFixed(0)} ms`,
              },
              {
                'Mean cost/case': `$${run.meanCostPerCase.toFixed(6)}`,
              },
              { 'Total cost': `$${run.totalCost.toFixed(6)}` },
              {
                Cases: `${run.results.length} (${run.results.filter((r) => r.success).length} passed)`,
              },
            );
            console.log(table.toString());
          }

          console.log();
        } catch (err) {
          console.error(chalk.red('✗ Evaluation failed:'), err);
          process.exitCode = 1;
        }
      },
    );
}

function qualityColor(quality: number, text: string): string {
  if (quality >= 0.99) return chalk.green(text);
  if (quality >= 0.97) return chalk.yellow(text);
  return chalk.red(text);
}
