// ──────────────────────────────────────────────────────────────
// meter trace [traceId] — inspect execution traces
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { Container, TOKENS } from '../container.js';
import type { ITraceStore } from '../ports/index.js';

export function registerTraceCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('trace [traceId]')
    .description('Inspect a trace or list recent traces')
    .option('-n, --limit <n>', 'Number of traces to list', '10')
    .action(async (traceId?: string, opts?: { limit?: string }) => {
      try {
        const traceStore = container.get<ITraceStore>(TOKENS.TraceStore);

        if (!traceId) {
          // List recent traces
          const limit = parseInt(opts?.limit ?? '10', 10);
          const traces = await traceStore.listTraces(limit);

          if (traces.length === 0) {
            console.log(
              chalk.yellow(
                'No traces found. Run "meter optimize" to generate traces.',
              ),
            );
            return;
          }

          console.log();
          console.log(chalk.bold.cyan('📋 Recent Traces'));
          console.log(chalk.dim('─'.repeat(60)));

          const table = new Table({
            head: ['Trace ID', 'Workflow', 'Status', 'Events', 'Started'],
            style: { head: ['cyan'] },
          });

          for (const t of traces) {
            const statusColor =
              t.status === 'COMPLETED'
                ? chalk.green
                : t.status === 'FAILED'
                  ? chalk.red
                  : chalk.yellow;
            table.push([
              t.id,
              t.workflowId,
              statusColor(t.status),
              String(t.events.length),
              t.startTime,
            ]);
          }

          console.log(table.toString());
          console.log();
          return;
        }

        // Show specific trace
        const trace = await traceStore.getTrace(traceId);
        if (!trace) {
          console.error(chalk.red(`✗ Trace not found: ${traceId}`));
          process.exitCode = 1;
          return;
        }

        console.log();
        console.log(
          chalk.bold.cyan(`🔍 Trace: ${trace.id}`),
        );
        console.log(chalk.dim('─'.repeat(60)));
        console.log(`  Workflow: ${trace.workflowId}`);
        console.log(
          `  Status:   ${trace.status === 'COMPLETED' ? chalk.green(trace.status) : trace.status === 'FAILED' ? chalk.red(trace.status) : chalk.yellow(trace.status)}`,
        );
        console.log(`  Started:  ${trace.startTime}`);
        if (trace.endTime) {
          console.log(`  Ended:    ${trace.endTime}`);
          const durationMs =
            new Date(trace.endTime).getTime() -
            new Date(trace.startTime).getTime();
          console.log(`  Duration: ${durationMs} ms`);
        }

        // Event tree
        if (trace.events.length > 0) {
          console.log();
          console.log(chalk.bold('  Events:'));
          for (const event of trace.events) {
            const prefix = event.parentEventId ? '  │   └──' : '  ├──';
            console.log(
              `${prefix} ${chalk.cyan(event.type)}`,
              chalk.dim(
                event.durationMs != null ? `(${event.durationMs} ms)` : '',
              ),
            );

            // Print key data points
            const data = event.data;
            for (const [key, value] of Object.entries(data)) {
              if (typeof value === 'object' && value !== null) {
                console.log(
                  chalk.dim(`  │       ${key}: ${JSON.stringify(value)}`),
                );
              } else {
                console.log(chalk.dim(`  │       ${key}: ${value}`));
              }
            }
          }
        }

        console.log();
      } catch (err) {
        console.error(chalk.red('✗ Trace inspection failed:'), err);
        process.exitCode = 1;
      }
    });
}
