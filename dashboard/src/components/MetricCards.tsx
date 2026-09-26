import React from 'react';
import {
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Flame,
  Snowflake,
  Sun,
  AlertTriangle,
} from 'lucide-react';
import type { OverviewMetrics } from '../lib/api';

interface MetricCardsProps {
  metrics: OverviewMetrics | null;
  loading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, loading }) => {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-zinc-900/60 border border-zinc-800" />
        ))}
      </div>
    );
  }

  const { stateCounts, baselineCost, optimizedCost, savingsPercent, activePolicy } = metrics;

  return (
    <div className="space-y-4">
      {/* Top Banner KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Savings Card (Hero) */}
        <div className="glass-card rounded-xl p-5 border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-zinc-900/80 to-zinc-950 relative overflow-hidden glow-cyan">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Estimated Cost Savings
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold text-white tracking-tight">
              {savingsPercent > 0 ? `${savingsPercent.toFixed(1)}%` : '0.0%'}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              reduction
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Baseline: <span className="font-mono text-zinc-300 font-semibold">${baselineCost.toFixed(4)}</span>
            </span>
            <span>→</span>
            <span>
              Optimized: <span className="font-mono text-cyan-300 font-semibold">${optimizedCost.toFixed(4)}</span>
            </span>
          </div>
        </div>

        {/* Active Production Policy Card */}
        <div className="glass-card rounded-xl p-5 border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active Runtime Policy
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-semibold text-zinc-200">
              Primary Routing:
            </div>
            <div className="text-base font-mono font-bold text-emerald-400 truncate mt-0.5">
              {activePolicy?.primary || 'frontier-x-default'}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
            <span>Fallback:</span>
            <span className="font-mono text-zinc-300 truncate max-w-[150px]">
              {activePolicy?.fallback?.length ? activePolicy.fallback.join(', ') : 'frontier-x-default'}
            </span>
          </div>
        </div>

        {/* Lifecycle States Breakdown Card */}
        <div className="glass-card rounded-xl p-5 border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Candidate Pool States
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-center space-x-1 text-emerald-400 text-[10px] font-bold">
                <Flame className="w-3 h-3" />
                <span>HOT</span>
              </div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">
                {stateCounts.HOT}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-center space-x-1 text-amber-400 text-[10px] font-bold">
                <Sun className="w-3 h-3" />
                <span>WARM</span>
              </div>
              <div className="text-lg font-bold text-amber-300 mt-0.5">
                {stateCounts.WARM}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center justify-center space-x-1 text-blue-400 text-[10px] font-bold">
                <Snowflake className="w-3 h-3" />
                <span>COLD</span>
              </div>
              <div className="text-lg font-bold text-blue-300 mt-0.5">
                {stateCounts.COLD}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center justify-center space-x-1 text-rose-400 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                <span>DEM</span>
              </div>
              <div className="text-lg font-bold text-rose-300 mt-0.5">
                {stateCounts.DEMOTED}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 text-center">
            {metrics.configurationsCount} total candidate configurations
          </div>
        </div>

        {/* Capability Contract Card */}
        <div className="glass-card rounded-xl p-5 border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Capability Contract
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Minimum Quality:</span>
              <span className="font-mono text-emerald-400 font-semibold">≥ 99.0%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">P95 Max Latency:</span>
              <span className="font-mono text-zinc-300">≤ 5,000 ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Critical Failures:</span>
              <span className="font-mono text-rose-400 font-semibold">0 allowed</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
            Workflow: <span className="text-zinc-300">Refund Resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};
