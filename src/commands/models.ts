// ──────────────────────────────────────────────────────────────
// meter models — list registered model profiles
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type { IModelRegistry } from '../ports/index.js';

export function registerModelsCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('models')
    .description('List all registered model profiles')
    .action(async () => {
      try {
        const registry = container.get<IModelRegistry>(TOKENS.ModelRegistry);
        const models = await registry.getAll();

        if (models.length === 0) {
          console.log(chalk.yellow('No models registered. Run "meter init" first.'));
          return;
        }

        console.log();
        console.log(chalk.bold.cyan('🤖 Model Registry'));
        console.log(chalk.dim('─'.repeat(70)));

        const table = new Table({
          head: [
            'ID',
            'Name',
            'Provider',
            'Quality',
            'Input $/M',
            'Output $/M',
            'Latency',
            'Context',
          ],
          style: { head: ['cyan'] },
        });

        for (const m of models) {
          table.push([
            m.id,
            m.name,
            m.provider,
            `${(m.quality * 100).toFixed(1)}%`,
            `$${m.inputCostPerMillionTokens.toFixed(2)}`,
            `$${m.outputCostPerMillionTokens.toFixed(2)}`,
            `${m.latencyMs} ms`,
            `${(m.contextWindow / 1000).toFixed(0)}K`,
          ]);
        }

        console.log(table.toString());
        console.log(chalk.dim(`  ${models.length} model(s) registered`));
        console.log();
      } catch (err) {
        console.error(chalk.red('✗ Failed to list models:'), err);
        process.exitCode = 1;
      }
    });
}
