# MeterCore

> **AI Workflow Cost Optimization Simulator**  
> CLI, REST API, and Web Dashboard for cost-aware model selection, automated qualification, and AI execution lifecycle management.

[![npm version](https://img.shields.io/npm/v/metercore.svg)](https://www.npmjs.com/package/metercore)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ⚡ Overview

MeterCore is a local-first simulation engine modeling the end-to-end optimization loop for AI workflows. Rather than routing all traffic to expensive frontier LLMs, MeterCore demonstrates how to safely evaluate, qualify, and dynamically allocate traffic to cheaper candidate configurations while strictly honoring quality, latency, context, and reliability contracts.

```text
Measure → Generate Candidates → Qualify → Optimize → Allocate → Observe → Demote/Fallback
```

### Key Capabilities
- **Simulated Profiles & Heuristics**: Tokenization and cost estimation across GPT-4o, Claude 3.5 Sonnet, Llama 3 70B, Mistral Small, and adapted configurations.
- **Capability Contracts & Multi-Dataset Qualification**: Evaluates candidates against Gold, Rolling, and Failure evaluation datasets.
- **Configuration Lifecycle Management**: Full state transitions across `COLD`, `WARM`, `HOT`, `CANARY`, `DEGRADED`, and `RETIRED`.
- **Live Traffic Simulation**: Real-time Shadow and Canary simulation modes.
- **Interactive REST API**: Built on [Hono](https://hono.dev/) with 22 structured endpoints.
- **Embedded Web Dashboard**: Modern React + Tailwind + Vite visualization suite.

---

## 📦 Installation

### Global CLI
```bash
npm install -g metercore
# or via npx
npx metercore --help
```

### In a Project
```bash
npm install metercore
```

---

## 🚀 Quick Start

Initialize the baseline dataset and models:
```bash
meter init
```

List available model configurations and their lifecycle states:
```bash
meter configs
```

Run cost analysis on an input payload:
```bash
meter analyze examples/damaged-item.json
```

Run the complete optimization decision loop:
```bash
meter optimize examples/damaged-item.json
```

Start the REST API server and web dashboard:
```bash
meter serve --port 3001
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🛠️ CLI Commands Reference

| Command | Description |
|---|---|
| `meter init` | Seeds default workflows, models, datasets, and baseline configurations |
| `meter models` | Lists all registered LLM profiles with token costs & qualities |
| `meter configs` | Lists execution configurations and their lifecycle states (`COLD`, `WARM`, `HOT`, etc.) |
| `meter analyze <file>` | Analyzes an input file for tokens, structure, and classification |
| `meter evaluate -c <id> -d <id>` | Evaluates a configuration against an evaluation dataset |
| `meter qualify <configId>` | Executes qualification across Gold, Rolling, and Failure datasets |
| `meter optimize <file>` | Runs full optimization loop to pick the cheapest qualified model |
| `meter trace [traceId]` | Inspects decision traces and optimization rationale |
| `meter shadow <configId> [count]` | Runs a shadow simulation alongside production traffic |
| `meter canary <configId> [percent]` | Runs a canary deployment simulation at a given traffic split |
| `meter simulate-degradation <id>` | Triggers simulated quality degradation, demoting model to `DEGRADED` |
| `meter serve [--port <number>]` | Starts the Hono REST API server (and serves dashboard if built) |

---

## 🌐 Programmatic API Usage

MeterCore can also be imported directly as a TypeScript/JavaScript library:

```typescript
import { bootstrap, TOKENS } from 'metercore';
import type { IAllocator, ExecutionConfiguration } from 'metercore';

const container = await bootstrap();
const allocator = container.get<IAllocator>(TOKENS.Allocator);

const bestConfig = await allocator.selectBest({
  taskComplexity: 'moderate',
  minQuality: 0.85,
  maxCostPerCall: 0.005,
});

console.log(`Selected configuration: ${bestConfig.id} (${bestConfig.modelId})`);
```

---

## 🧪 REST API Endpoints

When running `meter serve`:

- `GET /api/health` — Service health & uptime
- `GET /api/overview` — Aggregated KPI metrics (savings, allocations, counts)
- `GET /api/models` — Registered model profiles
- `GET /api/configs` — Execution configurations & qualification states
- `POST /api/configs/:id/qualify` — Trigger candidate qualification
- `POST /api/optimize` — Run optimization loop on submitted payload
- `GET /api/traces` — Audit trail of optimization decisions
- `GET /api/evidence` — Qualification proof records & evaluation runs
- `POST /api/simulations/shadow` — Run shadow evaluation simulation
- `POST /api/simulations/canary` — Run canary traffic routing simulation

---

## 📄 License

MIT © MikeyA-yo
