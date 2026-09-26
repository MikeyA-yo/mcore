// ──────────────────────────────────────────────────────────────
// meter serve
//
// Starts the MeterCore Hono HTTP REST API server.
// Serves endpoints for the React + shadcn web dashboard and automation.
// ──────────────────────────────────────────────────────────────

import chalk from 'chalk';
import type { Command } from 'commander';
import { Container } from '../container.js';
import { startApiServer } from '../api/server.js';

export function registerServeCommand(
  program: Command,
  container: Container,
): void {
  program
    .command('serve')
    .description('Start the MeterCore REST API server for the web dashboard (PRD §27)')
    .option('-p, --port <port>', 'Port number to listen on', '3001')
    .action((opts: { port: string }) => {
      const port = parseInt(opts.port, 10) || 3001;
      console.log(chalk.bold.cyan('⚡ Starting MeterCore REST API Server...'));
      startApiServer(container, port);
    });
}
