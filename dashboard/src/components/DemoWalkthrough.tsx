import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Wand2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';

interface DemoWalkthroughProps {
  onRefreshAll: () => Promise<void>;
  onSelectTrace: (traceId: string) => void;
}

export const DemoWalkthrough: React.FC<DemoWalkthroughProps> = ({
  onRefreshAll,
  onSelectTrace,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);

  const steps = [
    {
      num: 1,
      title: 'Step 1 — Baseline Incumbent',
      description: 'Establish initial baseline with large frontier model (Frontier-X: 99.7% quality, $0.080/case).',
      tag: 'BASELINE',
    },
    {
      num: 2,
      title: 'Step 2 — Discover Candidate',
      description: 'Find cheaper model Small-X ($0.012/case). Evaluated against capability contract (≥99.0%), but quality 96.8% rejects it.',
      tag: 'DISCOVERY',
    },
    {
      num: 3,
      title: 'Step 3 — Simulate TRL Adaptation',
      description: 'Apply simulated SFT fine-tuning on Gold dataset. Small-X + Adapter reaches 99.1% quality ($0.014/case).',
      tag: 'ADAPTATION',
    },
    {
      num: 4,
      title: 'Step 4 — Offline Qualification',
      description: 'Evaluate against Gold and Failure datasets across 10 repeated runs. 0 critical failures. Promoted: COLD → WARM.',
      tag: 'QUALIFY',
    },
    {
      num: 5,
      title: 'Step 5 — Shadow Traffic Simulation',
      description: 'Dispatch 100 requests in parallel to candidate & incumbent. Candidate maintains 99.1% quality. Promoted: WARM → HOT.',
      tag: 'SHADOW',
    },
    {
      num: 6,
      title: 'Step 6 — Production Allocation',
      description: 'Allocator picks cheapest qualifying HOT model (Small-X-Adapter) and designates Frontier-X as fallback.',
      tag: 'ALLOCATE',
    },
    {
      num: 7,
      title: 'Step 7 — Demonstrate Cost Savings',
      description: 'Spend drops from $0.080 to $0.014 per case — an 82.5% net computational cost reduction!',
      tag: 'SAVINGS',
    },
    {
      num: 8,
      title: 'Step 8 — Simulate Production Degradation',
      description: 'Simulate production quality drop: 99.1% ↓ 98.2%. Quality contract breached → DEMOTED → Fallback to Frontier-X immediately engages!',
      tag: 'FALLBACK',
    },
    {
      num: 9,
      title: 'Step 9 — Complete Audit Trace',
      description: 'Review the end-to-end trace log explaining every decision, statistical proof, and safety transition.',
      tag: 'OBSERVE',
    },
  ];

  const logMessage = (msg: string) => {
    setStepLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runStep = async (stepIndex: number) => {
    setIsRunning(true);
    try {
      switch (stepIndex) {
        case 1:
          logMessage('Resetting baseline to Frontier-X ($0.080/case)...');
          await api.initData();
          await onRefreshAll();
          logMessage('Baseline active: Frontier-X (HOT, 99.7% quality, $0.080/case).');
          break;

        case 2:
          logMessage('Discovering candidate Small-X ($0.012/case)...');
          const evalRes = await api.qualify('small-x-default');
          logMessage(`Candidate Small-X evaluated: ${evalRes.decision} (${evalRes.evidence.reason})`);
          break;

        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          logMessage('Running optimization loop (Adaptation → Qualification → Shadow → Allocation)...');
          const optRes = await api.optimize('Customer charged twice for order #4821. Requesting duplicate charge refund.');
          setLastTraceId(optRes.traceId);
          await onRefreshAll();
          logMessage(`Optimization complete! Trace: ${optRes.traceId}`);
          logMessage(`New Primary Allocated: ${optRes.allocation?.selectedConfigId || 'small-x-sft-adapted'}`);
          logMessage(`Savings: ${optRes.estimatedSavings?.savingsPercent}% ($${optRes.estimatedSavings?.incumbentCost} → $${optRes.estimatedSavings?.optimizedCost})`);
          break;

        case 8:
          logMessage('Simulating production quality drop on Small-X-Adapter (99.1% → 98.2%)...');
          const degRes = await api.simulateDegradation('small-x-sft-adapted', 0.982);
          await onRefreshAll();
          logMessage(`Degradation alert: ${degRes.message}`);
          logMessage(`Active Routing Fallback: ${degRes.fallbackSelectedId}`);
          break;

        case 9:
          logMessage('Opening complete audit trace...');
          if (lastTraceId) {
            onSelectTrace(lastTraceId);
          }
          await onRefreshAll();
          logMessage('Demo story sequence successfully completed!');
          break;

        default:
          break;
      }
      setCurrentStep(stepIndex);
    } catch (err: any) {
      logMessage(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runAll = async () => {
    setIsRunning(true);
    setStepLogs([]);
    logMessage('🚀 Starting Automated 9-Step Storyboard Walkthrough...');

    // Step 1
    logMessage('Step 1: Baseline established.');
    await api.initData();
    await onRefreshAll();
    setCurrentStep(1);

    // Step 2-7
    logMessage('Step 2-7: Executing candidates, adaptation, shadow qualification & allocation...');
    const opt = await api.optimize('Customer charged twice for subscription renewal.');
    setLastTraceId(opt.traceId);
    await onRefreshAll();
    setCurrentStep(7);
    logMessage(`Savings achieved: ${opt.estimatedSavings?.savingsPercent}% ($0.080 → $0.014/case)`);

    // Step 8
    logMessage('Step 8: Simulating degradation on adapted configuration...');
    const deg = await api.simulateDegradation('small-x-sft-adapted', 0.982);
    await onRefreshAll();
    setCurrentStep(8);
    logMessage(`Quality breached threshold! Demoted → Fallback switched back to ${deg.fallbackSelectedId}`);

    // Step 9
    setCurrentStep(9);
    logMessage('Step 9: Story completed. Full trace available for inspection.');
    if (opt.traceId) {
      onSelectTrace(opt.traceId);
    }
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-zinc-100">
              PRD §32 Primary Demo Storyboard
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            A step-by-step interactive demonstration of the core principle: a cheaper configuration does not earn production traffic simply by being cheap; it earns it through evaluation, adaptation, and shadow evidence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={runAll}
            disabled={isRunning}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>Run Full 9-Step Story</span>
          </button>

          <button
            onClick={() => {
              setCurrentStep(0);
              setStepLogs([]);
              api.initData().then(onRefreshAll);
            }}
            disabled={isRunning}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs sm:text-sm transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 9 Steps Visual Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((s) => {
          const isDone = currentStep >= s.num;
          const isCurrent = currentStep === s.num;

          return (
            <div
              key={s.num}
              onClick={() => !isRunning && runStep(s.num)}
              className={`glass-card p-4 rounded-xl border transition-all cursor-pointer ${
                isCurrent
                  ? 'border-cyan-400/80 bg-cyan-950/20 ring-1 ring-cyan-500/30 shadow-md'
                  : isDone
                  ? 'border-emerald-500/40 bg-zinc-900/60'
                  : 'border-zinc-800/80 bg-zinc-950/40 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase tracking-wider font-semibold">
                  {s.tag}
                </span>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-xs font-mono text-zinc-500">#{s.num}</span>
                )}
              </div>

              <h3 className="font-semibold text-sm text-zinc-100 mt-2.5">
                {s.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {s.description}
              </p>

              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 font-mono">
                  {isDone ? 'Completed' : 'Click to run'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Console Output Terminal */}
      <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-zinc-800 text-zinc-400">
          <span className="flex items-center space-x-2 text-cyan-400 font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Interactive Storyboard Output Log</span>
          </span>
          <span>{stepLogs.length} events logged</span>
        </div>
        <div className="h-40 overflow-y-auto space-y-1 font-mono text-xs text-zinc-300 pr-2">
          {stepLogs.length > 0 ? (
            stepLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log}
              </div>
            ))
          ) : (
            <div className="text-zinc-600 italic">
              Click "Run Full 9-Step Story" or click any individual step above to execute the scenario interactively.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
