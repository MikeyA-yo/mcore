// ──────────────────────────────────────────────────────────────
// meter configs — list execution configurations with states
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type { IStorageAdapter } from '../ports/index.js';
import type { ExecutionConfiguration } from '../domain/types.js';
import { QualificationState } from '../domain/types.js';

const STATE_COLORS: Record<QualificationState, (s: string) => string> = {
  [QualificationState.COLD]: chalk.blue,
  [QualificationState.WARM]: chalk.yellow,
  [QualificationState.HOT]: chalk.green,
  [QualificationState.DEMOTED]: chalk.red,
};

function stateLabel(state: QualificationState): string {
  const colorFn = STATE_COLORS[state] ?? chalk.white;
  return colorFn(state);
}

/** Per-case cost using the reference case (5K in + 1K out tokens). */
function perCaseCost(config: ExecutionConfiguration): number {
  return (
    (5_000 / 1_000_000) * config.inputCostPerMillionTokens +
    (1_000 / 1_000_000) * config.outputCostPerMillionTokens
  );
}

export function registerConfigsCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('configs')
    .description('List all execution configurations and their qualification states')
    .action(async () => {
      try {
        const storage = container.get<IStorageAdapter>(TOKENS.StorageAdapter);
        const configs =
          await storage.list<ExecutionConfiguration>('configurations');

        if (configs.length === 0) {
          console.log(chalk.yellow('No configurations found. Run "meter init" first.'));
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('⚙️  Execution Configurations'));
        console.log(chalk.dim('─'.repeat(70)));

        const table = new Table({
          head: ['ID', 'Model', 'State', 'Quality', 'Cost/case', 'Latency'],
          style: { head: ['cyan'] },
        });

        for (const c of configs) {
          table.push([
            c.id,
            c.modelId,
            stateLabel(c.state),
            `${(c.quality * 100).toFixed(1)}%`,
            `$${perCaseCost(c).toFixed(4)}`,
            `${Math.round(c.latencyMs)} ms`,
          ]);
        }

        console.log(table.toString());

        // Summary by state
        const counts = {
          HOT: configs.filter((c) => c.state === QualificationState.HOT).length,
          WARM: configs.filter((c) => c.state === QualificationState.WARM).length,
          COLD: configs.filter((c) => c.state === QualificationState.COLD).length,
          DEMOTED: configs.filter((c) => c.state === QualificationState.DEMOTED).length,
        };
        console.log(
          chalk.dim(
            `  ${chalk.green(counts.HOT + ' HOT')} · ${chalk.yellow(counts.WARM + ' WARM')} · ${chalk.blue(counts.COLD + ' COLD')} · ${chalk.red(counts.DEMOTED + ' DEMOTED')}`,
          ),
        );
        console.log();
      } catch (err) {
        console.error(chalk.red('✗ Failed to list configs:'), err);
        process.exitCode = 1;
      }
    });
}
