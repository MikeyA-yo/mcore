// ──────────────────────────────────────────────────────────────
// meter analyze <input> — analyse an input file or text
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type {
  IInputAnalyzer,
  ICostEngine,
  IStorageAdapter,
} from '../ports/index.js';
import type { ExecutionConfiguration } from '../domain/types.js';

export function registerAnalyzeCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('analyze <input>')
    .description('Analyse an input file and estimate token usage / costs')
    .option('--text', 'Treat <input> as raw text instead of a file path')
    .action(async (input: string, opts: { text?: boolean }) => {
      try {
        const analyzer = container.get<IInputAnalyzer>(TOKENS.InputAnalyzer);
        const costEngine = container.get<ICostEngine>(TOKENS.CostEngine);
        const storage = container.get<IStorageAdapter>(TOKENS.StorageAdapter);

        // Analyse
        const analysis = opts.text
          ? await analyzer.analyzeText(input)
          : await analyzer.analyzeFile(input);

        // Print analysis
        console.log();
        console.log(chalk.bold.cyan('📊 Input Analysis'));
        console.log(chalk.dim('─'.repeat(50)));

        const infoTable = new Table({ style: { head: ['cyan'] } });
        infoTable.push(
          { Type: analysis.type },
          ...(analysis.filePath
            ? [{ File: analysis.filePath }]
            : []),
          ...(analysis.characters !== undefined
            ? [{ Characters: analysis.characters.toLocaleString() }]
            : []),
          ...(analysis.words !== undefined
            ? [{ Words: analysis.words.toLocaleString() }]
            : []),
          { 'Estimated tokens': chalk.bold(analysis.estimatedTokens.toLocaleString()) },
          ...(analysis.imageUnits !== undefined
            ? [{ 'Image units': analysis.imageUnits.toLocaleString() }]
            : []),
          ...(analysis.fileSizeBytes !== undefined
            ? [{ 'File size': `${(analysis.fileSizeBytes / 1024).toFixed(1)} KB` }]
            : []),
        );
        console.log(infoTable.toString());

        // Warnings
        if (analysis.warnings.length > 0) {
          console.log();
          for (const w of analysis.warnings) {
            console.log(chalk.yellow('  ⚠'), chalk.dim(w));
          }
        }

        // Cost estimates across all configurations
        const configs = await storage.list<ExecutionConfiguration>('configurations');
        if (configs.length > 0) {
          // Assume output ≈ 30% of input tokens
          const outputTokens = Math.ceil(analysis.estimatedTokens * 0.3);
          const estimates = await costEngine.estimateAll(
            configs,
            analysis.estimatedTokens,
            outputTokens,
          );

          console.log();
          console.log(chalk.bold.cyan('💰 Cost Estimates'));
          console.log(chalk.dim('─'.repeat(50)));

          const costTable = new Table({
            head: ['Configuration', 'Input $', 'Output $', 'Total $'],
            style: { head: ['cyan'] },
          });

          for (const est of estimates.sort(
            (a, b) => a.totalCost - b.totalCost,
          )) {
            const cfg = configs.find((c) => c.id === est.configId);
            costTable.push([
              cfg?.id ?? est.configId,
              `$${est.inputCost.toFixed(6)}`,
              `$${est.outputCost.toFixed(6)}`,
              chalk.bold(`$${est.totalCost.toFixed(6)}`),
            ]);
          }

          console.log(costTable.toString());
          console.log(
            chalk.dim(
              `  Estimates assume ${analysis.estimatedTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens`,
            ),
          );
        }

        console.log();
      } catch (err) {
        console.error(chalk.red('✗ Analysis failed:'), err);
        process.exitCode = 1;
      }
    });
}
