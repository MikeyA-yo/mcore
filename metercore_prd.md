# AI Workflow Cost Optimization Simulator — Product Requirements Document

**Working title:** MeterCore
**Status:** Weekend MVP / Prototype
**Purpose:** Demonstrate the core ideas behind FirstMeter's AI workflow optimization loop without requiring access to real LLM providers, proprietary infrastructure, or actual model training.

## 1. Executive Summary
MeterCore is a local-first AI workflow cost optimization simulator.
It models an AI workflow and a pool of hypothetical model configurations, estimates the computational/token cost of processing inputs, evaluates candidate configurations against a defined quality contract, simulates post-training/fine-tuning when useful, and selects cheaper configurations when they satisfy the required capability constraints.

The system exposes the same optimization process through:
* a CLI for engineers and automation;
* a web dashboard for visualization and debugging;
* an observability/tracing layer showing the complete lifecycle of each optimization decision.

The system does not perform actual LLM inference in the MVP. Instead, models are represented by simulated profiles containing properties such as:
* input/output cost;
* quality;
* latency;
* reliability;
* context capacity;
* supported modalities;
* simulated adaptation potential.

This allows the prototype to demonstrate the central control loop:
`Measure → Generate Candidates → Qualify → Optimize → Allocate → Observe → Demote/Fallback`

## 2. Problem
AI workflows can become expensive when they rely on large frontier models for every request. However, simply switching to a cheaper model is unsafe.

A cheaper model may:
* produce lower-quality results;
* violate workflow policies;
* increase latency;
* fail on edge cases;
* require additional retries;
* perform poorly on specific inputs;
* violate provider or residency constraints.

Therefore, the optimization problem is not: *"What is the cheapest model?"*
It is: *"What is the cheapest execution configuration that satisfies the workflow's required capabilities?"*

MeterCore demonstrates this problem without requiring real model infrastructure.

## 3. Relationship to the FirstMeter Concept
MeterCore is not intended to reproduce FirstMeter. Instead, it implements a narrow experimental slice of the concepts described in the FirstMeter architecture.

| FirstMeter concept | MeterCore equivalent |
| :--- | :--- |
| Workflow | Simulated AI workflow |
| Capability Contract | Configurable quality/cost/latency constraints |
| Execution Configuration | Simulated model configuration |
| Candidate discovery | Candidate model pool |
| Qualification | Simulated evaluation engine |
| Gold dataset | Stable evaluation cases |
| Rolling dataset | Recent/simulated production cases |
| Failure dataset | Edge/critical cases |
| COLD | Candidate awaiting qualification |
| WARM | Passed offline qualification |
| HOT | Passed live/shadow/canary simulation |
| Allocator | Chooses qualifying configuration |
| Evidence Service | Stores evaluation/promotion evidence |
| Runtime Policy | Selected configuration + fallback |
| TRL/Axolotl | Simulated candidate adaptation |
| Observability | Execution traces + optimization history |
| Sigstore/Cosign | Optional simulated/small real signing layer |

## 4. Goals

### Primary goals

**G1 — Demonstrate cost-aware model selection**
Given an input and several hypothetical models, calculate estimated execution costs and determine which configurations satisfy the capability contract.

**G2 — Demonstrate qualification**
A cheaper model must earn the right to replace an incumbent configuration through evaluation.

**G3 — Demonstrate simulated post-training**
Represent the idea of using TRL/Axolotl-style post-training to improve a cheaper model's quality without actually training a model.

**G4 — Demonstrate lifecycle management**
Implement: `COLD → WARM → HOT → DEMOTED`

**G5 — Demonstrate observability**
Every optimization decision should be inspectable through a trace.

**G6 — Provide both CLI and web interfaces**
Engineers should be able to run the system from the terminal while the web interface provides visual understanding of what happened.

## 5. Non-Goals
The MVP will not:
* train an actual language model;
* run actual LLM inference;
* implement a production LLM gateway;
* reproduce Langfuse;
* reproduce Temporal;
* implement a full evaluation framework;
* provide real provider billing;
* guarantee provider-specific token counts;
* deploy production infrastructure;
* implement Kubernetes orchestration;
* build a general-purpose agent framework.

The project is a simulation and systems prototype.

## 6. Core Concept
The central abstraction is the **Execution Configuration**. A configuration is more than a model.

```text
Execution Configuration
│
├── model
├── provider/runtime
├── prompt/program version
├── workflow version
├── tool configuration
├── retrieval configuration
├── runtime parameters
└── evaluator/verifier
```

For the MVP, most of these can be represented rather than actually executed.

**Example:**
```json
{
  "id": "small-model-v3",
  "model": "small-model",
  "promptVersion": "refund-v2",
  "inputCostPerMillionTokens": 0.15,
  "outputCostPerMillionTokens": 0.60,
  "quality": 0.972,
  "latencyMs": 350
}
```

## 7. Capability Contract
Every workflow has a Capability Contract. The contract defines what must remain true regardless of which configuration is selected.

**Example:**
```json
{
  "workflow": "document-analysis",
  "minimumQuality": 0.985,
  "maximumP95LatencyMs": 5000,
  "maximumCriticalFailures": 0,
  "allowedProviders": [
    "provider-a",
    "local"
  ]
}
```
The optimizer may change the implementation. It may not violate the contract.

## 8. Example Optimization

Suppose the incumbent configuration is:
**Frontier-X**
* Quality: 99.7%
* Cost/case: $0.080
* Latency: 800ms

**Candidate:**
Small-X
* Quality: 96.8%
* Cost/case: $0.012
* Latency: 300ms

**Capability contract:**
* Quality ≥ 99.0%
* Critical failures = 0
* Latency < 5 seconds

Small-X is cheaper but does not qualify.
The simulator can then perform a simulated adaptation:

```text
Small-X
   │
   ▼
Simulated TRL adaptation
   │
   ▼
Small-X + Adapter
```

**Result:**
* Quality: 99.1%
* Cost/case: $0.014
* Latency: 320ms

Now the candidate qualifies.
The system can therefore demonstrate:
`$0.080 ↓ $0.014`

**82.5% estimated cost reduction** while satisfying the capability contract.
*(All values are simulated.)*

## 9. Input Analysis / Token Estimation
The system accepts:

**Text**
```bash
meter analyze ./document.txt
```

**Images**
```bash
meter analyze ./receipt.png
```

**Mixed inputs**
```bash
meter analyze ./request.json
```

The analyzer produces normalized usage units.
* **For text:** characters, words, estimated tokens
* **For images:** dimensions, file size, estimated image-token units

The MVP should clearly distinguish **Estimated usage** from **Provider-exact billing**. Provider-specific tokenization should not be represented as exact unless an actual provider tokenizer is used.

## 10. Cost Engine
The cost engine converts usage into estimated execution cost.

**For text:**
```
inputCost = (inputTokens / 1,000,000) × inputPricePerMillionTokens
outputCost = (outputTokens / 1,000,000) × outputPricePerMillionTokens
totalCost = inputCost + outputCost
```

**For a workflow:**
```
workflowCost = Σ stepCost
```

**For successful cases:**
```
costPerSuccessfulCase = totalCost / successfulCases
```
This is important because a cheap model that frequently fails can ultimately be more expensive.

## 11. Simulated Model Registry
The system contains a registry of hypothetical models.

| Model | Quality | Cost | Latency |
| :--- | :--- | :--- | :--- |
| Frontier-X | 99.7% | $0.080 | 800ms |
| Frontier-Y | 99.4% | $0.055 | 600ms |
| Small-X | 96.8% | $0.012 | 300ms |
| Local-X | 94.2% | $0.006 | 180ms |

Each model can have:
* quality score;
* input cost;
* output cost;
* latency;
* failure probability;
* capability tags;
* modality support;
* adaptation potential.

## 12. Candidate Generation
Candidates can originate from several sources.

```text
Candidate Sources
├── Existing cheaper model
├── Different provider
├── Open/local model
├── Specialized model
└── Simulated post-trained model
```

The system should not assume that every cheaper model requires training. Instead:

```text
candidate
   │
   ├── already qualifies → evaluate
   │
   └── doesn't qualify
            │
            ▼
       adaptation possible?
            │
            ▼
        simulate TRL
```
This better reflects the intended optimization loop.

## 13. Simulated TRL / Post-Training
The MVP does not import or execute actual TRL training. Instead, it models a post-training operation.

**Example:**
```json
{
  "baseModel": "small-x",
  "method": "simulated-sft",
  "dataset": "refund-gold-v4",
  "qualityImprovement": 0.023,
  "additionalCost": 0.002,
  "latencyChange": 20
}
```

**Possible methods:** SFT, DPO, GRPO, LoRA, QLoRA
These are representations, not actual training algorithms in the MVP.

The resulting candidate becomes: `small-x + adapter-v1` and enters qualification like any other candidate.

## 14. Evaluation Engine
The evaluation engine tests candidates against datasets. Each dataset contains cases with expected behavior.

**Example:**
```json
{
  "input": "Customer was charged twice",
  "expectedOutcome": "refund_duplicate_charge",
  "critical": true
}
```

The simulator determines whether the candidate:
* succeeds;
* fails;
* produces a critical failure;
* meets latency constraints;
* satisfies the quality contract.

## 15. Evaluation Datasets
* **Gold:** Stable, verified examples representing expected behavior.
  * *Purpose:* Establish baseline capability.
* **Rolling:** Recent workflow examples.
  * *Purpose:* Detect changes in current workload behavior.
* **Failure:** Difficult, edge-case, or historically problematic examples.
  * *Purpose:* Prevent optimization from hiding dangerous failures.

## 16. Repeated Evaluation
Candidates should not be promoted based on one evaluation.

**Example:**
* Runs: 10
* Mean quality: 99.12%
* Std deviation: 0.11%
* 95% confidence: 98.98–99.26%
* Critical failures: 0

This provides evidence for the promotion decision.
The MVP should store:
* dataset version;
* evaluator version;
* number of runs;
* quality statistics;
* critical failures;
* latency;
* estimated cost.

## 17. Qualification State Machine

```text
                   ┌─────────┐
                   │  COLD   │
                   └────┬────┘
                        │
                 offline passes
                        │
                        ▼
                   ┌─────────┐
                   │  WARM   │
                   └────┬────┘
                        │
                  shadow passes
                        │
                        ▼
                   ┌─────────┐
                   │   HOT   │
                   └────┬────┘
                        │
                  quality drops
                        │
                        ▼
                  ┌───────────┐
                  │ DEMOTED   │
                  └───────────┘
```

* **COLD:** Candidate exists but is not trusted.
* **WARM:** Candidate passed offline qualification and may participate in shadow testing.
* **HOT:** Candidate passed live qualification and can receive production traffic.
* **DEMOTED:** Candidate previously qualified but no longer satisfies the required conditions.

## 18. Evidence
Every promotion/demotion should have evidence.

**Example:**
```json
{
  "configId": "small-x-adapter-v1",
  "workflowVersion": "refund-v2",
  "datasetVersion": "gold-v4",
  "evaluatorVersion": "refund-evaluator-v3",
  "runs": 10,
  "quality": 0.991,
  "criticalFailures": 0,
  "p95LatencyMs": 420,
  "costPerSuccessfulCase": 0.014,
  "decision": "PROMOTE",
  "reason": "Candidate satisfies all capability constraints.",
  "expiresAt": "2026-10-02T00:00:00Z"
}
```
The UI should make this evidence inspectable.

## 19. Shadow Simulation
The system should support simulated live traffic.

```text
Production input
       │
       ├──────────────► Incumbent
       │
       └──────────────► Candidate
                              │
                              ▼
                         compare results
```
The candidate's output does not affect the simulated customer outcome.
The system records: quality, latency, estimated cost, failures.

## 20. Canary Simulation
After shadow qualification:

```text
HOT candidate
   │
5% traffic
   ↓
10% traffic
   ↓
25% traffic
   ↓
50%
```

The MVP does not need real traffic. A simulator can generate `1000 requests` and assign:
* 5% → candidate
* 95% → incumbent
Then compare outcomes.

## 21. Allocator
The allocator chooses among currently Hot configurations.

**Example:**
* **HOT:** Frontier-X (Quality: 99.7%, Cost: $0.080)
* **HOT:** Small-X + Adapter (Quality: 99.1%, Cost: $0.014)

If both satisfy the contract, the allocator can select the cheaper one according to the configured optimization objective.
The allocator should also maintain fallback information:
```json
{
  "primary": "small-x-adapter-v1",
  "fallback": [
    "frontier-x"
  ]
}
```

## 22. Demotion
A Hot configuration should not be considered permanently trusted.

**Example:**
* Small-X + Adapter (HOT - 99.1%)
* Simulated production degradation: 98.2%
* Contract: ≥99.0%

**System:**
`HOT ↓ quality violation ↓ DEMOTE ↓ remove from allocation ↓ select fallback ↓ Frontier-X`

This should be one of the primary demo scenarios.

## 23. Runtime Policy
The control plane produces a runtime policy.

**Example:**
```json
{
  "workflow": "refund-v2",
  "primary": "small-x-adapter-v1",
  "fallback": [
    "frontier-x"
  ],
  "policyVersion": 17,
  "expiresAt": "2026-10-02T00:00:00Z"
}
```

**Optional advanced feature:**
```text
Runtime Policy
      ↓
   Cosign
      ↓
signed artifact
      ↓
runtime verification
```
This demonstrates the distinction between: *"The control plane approved this."* and: *"The runtime is actually executing the approved configuration."*

## 24. Observability
Every important action produces an event/trace.

**Example Trace:** `exec_8472`
```text
├── INPUT_ANALYSIS
│   ├── tokens: 14,823
│   └── imageUnits: 1,024
│
├── COST_ESTIMATION
│   ├── frontier-x: $0.081
│   └── small-x: $0.013
│
├── CANDIDATE_EVALUATION
│   └── small-x: FAILED_QUALITY
│
├── POST_TRAINING_SIMULATION
│   └── small-x-adapter-v1
│
├── QUALIFICATION
│   ├── quality: 99.1%
│   └── criticalFailures: 0
│
├── PROMOTION
│   └── COLD → WARM
│
└── ALLOCATION
    └── small-x-adapter-v1
```

## 25. Web Dashboard
The dashboard should prioritize understanding rather than visual complexity.

**Overview**
* Workflows: 1
* Configurations: 5
* HOT: 2
* WARM: 1
* COLD: 2
* Estimated baseline: $8.10
* Optimized: $1.42
* **Estimated savings: 82.5%**

**Configuration table**

| Configuration | State | Quality | Cost | Latency |
| :--- | :--- | :--- | :--- | :--- |
| Frontier-X | HOT | 99.7% | $0.080 | 800ms |
| Small-X | WARM | 98.4% | $0.012 | 300ms |
| Small-X + TRL | HOT | 99.1% | $0.014 | 320ms |
| Local-X | COLD | 94.2% | $0.006 | 180ms |

**Evidence panel**
Selecting a configuration shows: evaluator, dataset, runs, quality, confidence interval, failures, cost, latency, promotion reason, expiry.

**Trace panel**
Display the lifecycle of an individual execution.

## 26. CLI
The CLI is a first-class interface.

* Analyze input: `meter analyze ./document.txt`
* List models: `meter models`
* Evaluate: `meter evaluate --config small-x --dataset gold-v1`
* Qualify: `meter qualify small-x`
* Run optimization: `meter optimize ./document.txt`
* Inspect trace: `meter trace exec_8472`
* List configurations: `meter configs`
* Simulate degradation: `meter simulate-degradation small-x-adapter-v1`

## 27. API
A minimal HTTP API:

```
POST /api/analyze
POST /api/evaluate
POST /api/qualify
POST /api/optimize
GET  /api/models
GET  /api/configurations
GET  /api/configurations/:id
GET  /api/evidence/:id
POST /api/shadow
POST /api/canary
POST /api/configurations/:id/demote
POST /api/allocate
GET  /api/traces/:id
```

## 28. Data Model

**Core entities:**
```text
Workflow
    │
    ├── CapabilityContract
    │
    └── WorkflowVersion
             │
             └── ExecutionConfiguration
                       │
                       ├── EvaluationRun
                       │
                       └── QualificationEvidence
                                      │
                                      ▼
                                  State
```

**Suggested tables:**
`workflows`, `workflow_versions`, `capability_contracts`, `models`, `execution_configurations`, `datasets`, `dataset_cases`, `evaluation_runs`, `qualification_evidence`, `state_transitions`, `runtime_policies`, `traces`, `trace_events`, `allocation_decisions`

## 29. Suggested Tech Stack
* **Backend:** TypeScript, Hono, PostgreSQL, Drizzle ORM
* **Frontend:** Next.js, TypeScript, shadcn/ui, Recharts
* **Evaluation:** Start with native TypeScript. Optionally integrate Promptfoo or DeepEval later.
* **Observability:** For the MVP: OpenTelemetry-compatible event model. A full Langfuse deployment is optional.
* **Future orchestration:** Temporal (can replace synchronous evaluation flows with durable workflows).

## 30. Suggested Architecture

```text
                         ┌───────────────────┐
                         │     CLI           │
                         └─────────┬─────────┘
                                   │
                         ┌─────────▼─────────┐
                         │     Hono API      │
                         └─────────┬─────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                     │
              ▼                    ▼                     ▼
      ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
      │ Input / Cost │     │ Qualification│     │  Allocator   │
      │   Engine     │     │   Service    │     │              │
      └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
             │                    │                    │
             │             ┌──────▼───────┐            │
             │             │   Evidence   │            │
             │             │   Service    │            │
             │             └──────┬───────┘            │
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  ▼
                           ┌──────────────┐
                           │  PostgreSQL  │
                           └──────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Observability   │
                         │ / Trace Store   │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Web Console   │
                         └─────────────────┘
```

## 31. Weekend MVP
The project should be deliberately constrained.

**Must have**
* Input analysis
* Token/cost estimation
* Model registry
* Capability Contract
* Candidate configurations
* Evaluation engine
* Qualification evidence
* COLD/WARM/HOT lifecycle
* Allocator
* Demotion/fallback
* CLI
* Basic web dashboard
* Execution traces

**Nice to have**
* Simulated TRL adaptation
* Shadow simulation
* Canary simulation
* Confidence intervals
* Cost savings graphs
* Signed runtime policy
* Cosign integration

**Do not build this weekend**
* Actual model training
* Kubernetes
* Full Temporal architecture
* Full Langfuse replacement
* Multi-tenant authentication
* Real production provider orchestration

## 32. Primary Demo Scenario
The demo should tell one coherent story.

* **Step 1 — Baseline:** Workflow: Refund Resolution. Incumbent: Frontier-X (Quality: 99.7%, Cost: $0.080/case)
* **Step 2 — Discover candidate:** Small-X (Quality: 96.8%, Cost: $0.012/case). Rejected.
* **Step 3 — Simulate adaptation:** `Small-X + Simulated TRL adaptation ↓ Small-X-Adapter` (Quality: 99.1%, Cost: $0.014/case)
* **Step 4 — Qualify:** Gold dataset ✓, Failure dataset ✓, Repeated evaluation ✓, Critical failures = 0 ✓. `COLD → WARM`
* **Step 5 — Shadow:** Candidate observes simulated production traffic. Shadow quality: 99.08%. `WARM → HOT`
* **Step 6 — Allocate:** `Small-X-Adapter ↓ production allocation`
* **Step 7 — Demonstrate savings:** $0.080 → $0.014 (82.5% estimated savings)
* **Step 8 — Simulate degradation:** Quality falls: 99.08% ↓ 98.4%. Contract: ≥99.0%. Therefore: `HOT ↓ DEMOTED ↓ fallback ↓ Frontier-X`
* **Step 9 — Show trace:** The web dashboard explains the entire sequence.

## 33. What This Demonstrates
The prototype demonstrates that the developer understands:
* AI workflow optimization;
* model cost economics;
* token-based cost estimation;
* capability contracts;
* candidate generation;
* evaluation;
* qualification;
* evidence;
* state machines;
* shadow/canary deployment;
* routing/allocation;
* fallback;
* observability;
* post-training as candidate generation;
* separation of control plane and execution/data plane.

**Most importantly, it demonstrates:** A cheaper configuration does not become trusted simply because it is cheaper. It earns production eligibility through evidence.

## 34. Future Evolution
After the simulator works, components can gradually become real.

```text
MVP
 │
 ├── simulated models
 ├── simulated quality
 └── simulated TRL
        │
        ▼
Phase 2
 │
 ├── real tokenizers
 ├── real LLM APIs
 └── real evaluation
        │
        ▼
Phase 3
 │
 ├── real shadow traffic
 ├── real routing
 ├── real observability
 └── real model candidates
        │
        ▼
Phase 4
 │
 ├── actual post-training
 ├── durable workflows
 ├── signed runtime policies
 └── production infrastructure
```

## 35. Design Principles
* **Principle 1 — Optimize successful work, not raw model cost:** A $0.01 request that fails repeatedly is not necessarily cheaper than a $0.05 request that succeeds.
* **Principle 2 — Quality is a constraint:** The optimizer should never optimize cost independently of the Capability Contract.
* **Principle 3 — Evidence precedes trust:** `Candidate ≠ Trusted`. Qualification evidence is what moves a configuration toward production.
* **Principle 4 — Trust expires:** Evidence should have freshness/expiry.
* **Principle 5 — Production changes must be reversible:** Every optimization should have a fallback.
* **Principle 6 — Models are replaceable implementations:** The workflow's required capability should remain stable even when its implementation changes.
* **Principle 7 — Observability is part of the product:** Every important optimization decision should be explainable after the fact.

## 36. One-Sentence Product Definition
MeterCore is a simulated control plane that demonstrates how an AI workflow can continuously discover, qualify, select, and monitor cheaper execution configurations while preserving a defined capability contract.

## 37. One-Sentence Pitch for the Team
“I built a small experimental version of the optimization loop from the PRD: it estimates input costs, models multiple candidate configurations, simulates post-training for cheaper candidates, qualifies them against a capability contract, promotes them through Cold/Warm/Hot states, allocates traffic to qualified configurations, and provides CLI plus web-based traces showing why each decision happened.”