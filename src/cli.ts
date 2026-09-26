#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// MeterCore CLI — entry point
//
// Usage:
//   meter init                          — seed data
//   meter models                        — list models
//   meter configs                       — list configurations
//   meter analyze <file>                — analyse input
//   meter evaluate -c <id> -d <id>      — evaluate config
//   meter qualify <configId>            — run qualification
//   meter optimize <file>               — full optimisation loop
//   meter trace [traceId]               — inspect traces
//   meter simulate-degradation <id>     — demo demotion/fallback
// ──────────────────────────────────────────────────────────────

import { Command } from 'commander';
import { bootstrap } from './bootstrap.js';

// Commands
import { registerInitCommand } from './commands/init.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerModelsCommand } from './commands/models.js';
import { registerConfigsCommand } from './commands/configs.js';
import { registerEvaluateCommand } from './commands/evaluate.js';
import { registerQualifyCommand } from './commands/qualify.js';
import { registerOptimizeCommand } from './commands/optimize.js';
import { registerTraceCommand } from './commands/trace.js';
import { registerSimulateDegradationCommand } from './commands/simulate-degradation.js';
import { registerShadowCommand } from './commands/shadow.js';
import { registerCanaryCommand } from './commands/canary.js';
import { registerServeCommand } from './commands/serve.js';

async function main() {
  const container = await bootstrap();

  const program = new Command();

  program
    .name('meter')
    .description(
      'MeterCore — AI Workflow Cost Optimisation Simulator\n\n' +
        'Demonstrates how an AI workflow can continuously discover, qualify,\n' +
        'select, and monitor cheaper execution configurations while preserving\n' +
        'a defined capability contract.',
    )
    .version('0.1.0');

  // Register all commands
  registerInitCommand(program, container);
  registerAnalyzeCommand(program, container);
  registerModelsCommand(program, container);
  registerConfigsCommand(program, container);
  registerEvaluateCommand(program, container);
  registerQualifyCommand(program, container);
  registerOptimizeCommand(program, container);
  registerTraceCommand(program, container);
  registerSimulateDegradationCommand(program, container);
  registerShadowCommand(program, container);
  registerCanaryCommand(program, container);
  registerServeCommand(program, container);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
