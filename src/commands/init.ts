// ──────────────────────────────────────────────────────────────
// meter init — initialise / re-seed MeterCore data
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import type { Command } from 'commander';
import { reseed } from '../bootstrap.js';
import type { Container } from '../container.js';

export function registerInitCommand(
  program: Command,
  _container: Container,
): void {
  program
    .command('init')
    .description('Initialise MeterCore with seed data (models, workflows, datasets)')
    .option('--force', 'Overwrite existing data with fresh seed values')
    .action(async (opts: { force?: boolean }) => {
      try {
        await reseed();
        console.log(
          chalk.green('✓'),
          opts.force
            ? 'Data re-seeded with defaults.'
            : 'MeterCore initialised with seed data.',
        );
        console.log(
          chalk.dim('  Data directory: ~/.metercore/data/'),
        );
        console.log();
        console.log(chalk.bold('Quick start:'));
        console.log(chalk.dim('  meter models          — list registered models'));
        console.log(chalk.dim('  meter configs         — list execution configurations'));
        console.log(chalk.dim('  meter analyze <file>  — analyse an input file'));
        console.log(chalk.dim('  meter optimize <file> — run the full optimisation loop'));
      } catch (err) {
        console.error(chalk.red('✗ Init failed:'), err);
        process.exitCode = 1;
      }
    });
}
