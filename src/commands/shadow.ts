// ──────────────────────────────────────────────────────────────
// meter shadow <configId>
//
// Simulates live shadow traffic: dispatches requests to both
// incumbent and candidate in parallel (PRD §19).
// Promotes WARM → HOT if Capability Contract is satisfied.
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type { IShadowSimulator } from '../ports/index.js';

export function registerShadowCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('shadow <configId>')
    .description('Run shadow traffic simulation against the incumbent configuration (PRD §19)')
    .option('-w, --workflow <id>', 'Workflow ID', 'refund-resolution')
    .option('-r, --requests <count>', 'Number of shadow requests to dispatch', '100')
    .action(
      async (
        configId: string,
        opts: { workflow: string; requests: string },
      ) => {
        try {
          const shadowSim = container.get<IShadowSimulator>(TOKENS.ShadowSimulator);
          const reqCount = parseInt(opts.requests, 10) || 100;

          console.log();
          console.log(chalk.bold.cyan(`🛰️  Running Shadow Simulation: ${configId}`));
          console.log(chalk.dim(`   Dispatching ${reqCount} parallel shadow requests against incumbent...`));
          console.log();

          const result = await shadowSim.simulateShadow(configId, opts.workflow, reqCount);

          const table = new Table({
            head: ['Metric', 'Candidate', 'Incumbent'],
            style: { head: ['cyan'] },
          });

          table.push(
            ['Configuration', result.configId, result.incumbentConfigId],
            [
              'Quality',
              result.qualified
                ? chalk.green(`${(result.candidateQuality * 100).toFixed(1)}%`)
                : chalk.red(`${(result.candidateQuality * 100).toFixed(1)}%`),
              `${(result.incumbentQuality * 100).toFixed(1)}%`,
            ],
            ['Mean Latency', `${result.candidateMeanLatencyMs} ms`, `${result.incumbentMeanLatencyMs} ms`],
            ['Cost / Case', `$${result.candidateCostPerCase.toFixed(4)}`, `$${result.incumbentCostPerCase.toFixed(4)}`],
            [
              'Critical Failures',
              result.criticalFailures === 0
                ? chalk.green('0')
                : chalk.red(result.criticalFailures.toString()),
              '0',
            ],
          );

          console.log(table.toString());
          console.log();

          if (result.promotedToHot) {
            console.log(
              chalk.green.bold('  ✓ PROMOTED: WARM → HOT'),
            );
            console.log(chalk.green(`    ${result.reason}`));
            console.log(chalk.dim('    Configuration is now eligible for production allocation!'));
          } else {
            console.log(chalk.red.bold('  ✗ DID NOT QUALIFY FOR HOT'));
            console.log(chalk.red(`    ${result.reason}`));
          }
          console.log();
        } catch (err: unknown) {
          console.error(chalk.red('✗ Shadow simulation failed:'), (err as Error).message);
          process.exitCode = 1;
        }
      },
    );
}
