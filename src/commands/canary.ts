// ──────────────────────────────────────────────────────────────
// meter canary <configId>
//
// Simulates progressive canary traffic ramp-up (PRD §20).
// Steps: 5% → 10% → 25% → 50% → 100%
// Measures reliability and aborts if safety thresholds are breached.
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type { ICanarySimulator } from '../ports/index.js';

export function registerCanaryCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('canary <configId>')
    .description('Run progressive canary traffic deployment simulation (PRD §20)')
    .option('-w, --workflow <id>', 'Workflow ID', 'refund-resolution')
    .option('-n, --requests <count>', 'Total synthetic requests to generate across steps', '1000')
    .action(
      async (
        configId: string,
        opts: { workflow: string; requests: string },
      ) => {
        try {
          const canarySim = container.get<ICanarySimulator>(TOKENS.CanarySimulator);
          const totalReqs = parseInt(opts.requests, 10) || 1000;

          console.log();
          console.log(chalk.bold.cyan(`🐤 Running Canary Deployment Simulation: ${configId}`));
          console.log(chalk.dim(`   Simulating progressive ramp-up across ${totalReqs} requests...`));
          console.log();

          const result = await canarySim.simulateCanary(configId, opts.workflow, totalReqs);

          const table = new Table({
            head: ['Traffic %', 'Requests', 'Candidate Success', 'Incumbent Success', 'P95 Latency', 'Status'],
            style: { head: ['cyan'] },
          });

          for (const step of result.steps) {
            table.push([
              `${step.trafficPercent}%`,
              step.requestsRouted.toString(),
              `${(step.candidateSuccessRate * 100).toFixed(1)}%`,
              `${(step.incumbentSuccessRate * 100).toFixed(1)}%`,
              `${step.candidateLatencyP95} ms`,
              step.passed ? chalk.green('PASSED') : chalk.red('FAILED'),
            ]);
          }

          console.log(table.toString());
          console.log();

          if (result.status === 'PASSED') {
            console.log(chalk.green.bold('  ✓ CANARY DEPLOYMENT SUCCESSFUL'));
            console.log(chalk.green(`    ${result.reason}`));
            console.log(chalk.dim(`    Overall candidate success rate: ${(result.overallSuccessRate * 100).toFixed(1)}%`));
            console.log(chalk.dim(`    Estimated cost for batch: $${result.estimatedCost.toFixed(2)}`));
          } else {
            console.log(chalk.red.bold('  ✗ CANARY ROLLED BACK'));
            console.log(chalk.red(`    ${result.reason}`));
            console.log(chalk.yellow('    Traffic automatically returned 100% to incumbent configuration.'));
          }
          console.log();
        } catch (err: unknown) {
          console.error(chalk.red('✗ Canary simulation failed:'), (err as Error).message);
          process.exitCode = 1;
        }
      },
    );
}
