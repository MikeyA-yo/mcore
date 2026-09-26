import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingDown, DollarSign } from 'lucide-react';
import type { ExecutionConfiguration } from '../lib/api';

interface SavingsChartProps {
  configs: ExecutionConfiguration[];
}

export const SavingsChart: React.FC<SavingsChartProps> = ({ configs }) => {
  const getPerCaseCost = (c: ExecutionConfiguration) => {
    return (
      (5000 / 1_000_000) * c.inputCostPerMillionTokens +
      (1000 / 1_000_000) * c.outputCostPerMillionTokens
    );
  };

  const chartData = configs.map((c) => {
    const cost = getPerCaseCost(c);
    const isHot = c.state === 'HOT';
    const isCheapestHot = isHot && c.id.includes('small');

    return {
      name: c.id.replace('-default', '').replace('-adapted', '+TRL'),
      cost: Number(cost.toFixed(4)),
      quality: Number((c.quality * 100).toFixed(1)),
      state: c.state,
      isCheapestHot,
    };
  }).sort((a, b) => b.cost - a.cost);

  const baselineCost = 0.08; // Frontier-X reference
  const optimizedCost = 0.014; // Small-X + Adapter reference
  const savingsPerCase = baselineCost - optimizedCost;

  const volumes = [
    { label: '1,000 req/day', monthlyBaseline: 1000 * 30 * baselineCost, monthlyOptimized: 1000 * 30 * optimizedCost },
    { label: '10,000 req/day', monthlyBaseline: 10000 * 30 * baselineCost, monthlyOptimized: 10000 * 30 * optimizedCost },
    { label: '100,000 req/day', monthlyBaseline: 100000 * 30 * baselineCost, monthlyOptimized: 100000 * 30 * optimizedCost },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Cost Comparison Bar Chart */}
      <div className="lg:col-span-2 glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              <span>Execution Cost Comparison ($ / Case)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Reference standard: 5,000 input tokens + 1,000 output tokens per case
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            82.5% Max Delta
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono shadow-xl">
                        <div className="font-bold text-zinc-100">{data.name}</div>
                        <div className="text-cyan-400 mt-1">Cost: ${data.cost.toFixed(4)} / case</div>
                        <div className="text-emerald-400">Quality: {data.quality}%</div>
                        <div className="text-zinc-400">State: {data.state}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.name.includes('frontier-x')
                        ? '#ef4444' // Baseline red
                        : entry.state === 'HOT'
                        ? '#10b981' // Qualified Hot green
                        : entry.state === 'WARM'
                        ? '#f59e0b'
                        : '#3b82f6'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-zinc-400 pt-1">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Baseline (Frontier-X)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Qualified Production (HOT)</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Candidate (COLD)</span>
          </span>
        </div>
      </div>

      {/* Right Col: Projected Volume Savings Table */}
      <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="pb-2 border-b border-zinc-800/80">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center space-x-2">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span>Projected Monthly Spend</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Baseline Frontier vs Optimized MeterCore
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {volumes.map((vol) => {
            const savings = vol.monthlyBaseline - vol.monthlyOptimized;

            return (
              <div
                key={vol.label}
                className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1.5"
              >
                <div className="flex justify-between items-center text-zinc-300 font-semibold">
                  <span>{vol.label}</span>
                  <span className="text-emerald-400">
                    -${savings.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-zinc-500">
                  <span>Baseline: ${vol.monthlyBaseline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span>Optimized: ${vol.monthlyOptimized.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          <span className="font-semibold block">Net 82.5% Cost Reduction</span>
          Achieved without lowering the 99.0% quality contract or introducing critical failures.
        </div>
      </div>
    </div>
  );
};
