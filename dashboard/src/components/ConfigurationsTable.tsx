import React, { useState } from 'react';
import {
  Flame,
  Snowflake,
  Sun,
  AlertTriangle,
  Play,
  Activity,
  ShieldCheck,
  Layers,
  TrendingDown,
  Info,
} from 'lucide-react';
import type { ExecutionConfiguration } from '../lib/api';

interface ConfigurationsTableProps {
  configs: ExecutionConfiguration[];
  onShadowTest: (configId: string) => void;
  onCanaryTest: (configId: string) => void;
  onQualify: (configId: string) => void;
  onDegrade: (configId: string) => void;
  onViewEvidence: (configId: string) => void;
  loadingAction: string | null;
}

export const ConfigurationsTable: React.FC<ConfigurationsTableProps> = ({
  configs,
  onShadowTest,
  onCanaryTest,
  onQualify,
  onDegrade,
  onViewEvidence,
  loadingAction,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'HOT' | 'WARM' | 'COLD' | 'DEMOTED'>('ALL');

  const filtered = configs.filter((c) => {
    if (filter === 'ALL') return true;
    return c.state === filter;
  });

  const getPerCaseCost = (c: ExecutionConfiguration) => {
    return (
      (5000 / 1_000_000) * c.inputCostPerMillionTokens +
      (1000 / 1_000_000) * c.outputCostPerMillionTokens
    );
  };

  const renderStateBadge = (state: string) => {
    switch (state) {
      case 'HOT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Flame className="w-3 h-3" />
            <span>HOT</span>
          </span>
        );
      case 'WARM':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Sun className="w-3 h-3" />
            <span>WARM</span>
          </span>
        );
      case 'DEMOTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>DEMOTED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Snowflake className="w-3 h-3" />
            <span>COLD</span>
          </span>
        );
    }
  };

  return (
    <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Candidate Execution Configurations</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Models qualify through evaluation and shadow simulation before receiving production traffic.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          {(['ALL', 'HOT', 'WARM', 'COLD', 'DEMOTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === tab
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950/60 text-xs text-zinc-400 uppercase tracking-wider font-mono border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">Configuration ID</th>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4">Quality</th>
              <th className="py-3 px-4">Cost / Case</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4">Token Pricing</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filtered.map((config) => {
              const cost = getPerCaseCost(config);
              const isLoading = loadingAction === config.id;
              const satisfiesQuality = config.quality >= 0.99;

              return (
                <tr key={config.id} className="hover:bg-zinc-800/20 transition-colors">
                  {/* ID & Model */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-medium text-zinc-200 text-xs sm:text-sm">
                      {config.id}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Base Model: <span className="text-zinc-400">{config.modelId}</span>
                      {config.adaptationMethod && (
                        <span className="ml-1.5 px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
                          {config.adaptationMethod.replace('simulated-', '')}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* State */}
                  <td className="py-3.5 px-4">{renderStateBadge(config.state)}</td>

                  {/* Quality */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`font-mono font-semibold text-sm ${
                          satisfiesQuality ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {(config.quality * 100).toFixed(1)}%
                      </span>
                      {satisfiesQuality ? (
                        <span className="text-[10px] text-emerald-500/80">≥99%</span>
                      ) : (
                        <span className="text-[10px] text-rose-500/80">&lt;99%</span>
                      )}
                    </div>
                  </td>

                  {/* Cost per case */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono font-semibold text-zinc-200 text-sm">
                      ${cost.toFixed(4)}
                    </div>
                    <div className="text-[11px] text-zinc-500">per 5K in / 1K out</div>
                  </td>

                  {/* Latency */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-zinc-300 text-sm">{config.latencyMs} ms</div>
                    <div className="text-[11px] text-zinc-500">&lt; 5,000 ms</div>
                  </td>

                  {/* Token pricing */}
                  <td className="py-3.5 px-4 font-mono text-xs text-zinc-400">
                    <div>In: ${config.inputCostPerMillionTokens.toFixed(2)}/M</div>
                    <div>Out: ${config.outputCostPerMillionTokens.toFixed(2)}/M</div>
                  </td>

                  {/* Action buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {/* Qualify */}
                      {config.state === 'COLD' && (
                        <button
                          onClick={() => onQualify(config.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
                          title="Run repeated evaluation against gold & failure datasets"
                        >
                          Qualify
                        </button>
                      )}

                      {/* Shadow test */}
                      {(config.state === 'WARM' || config.state === 'COLD') && (
                        <button
                          onClick={() => onShadowTest(config.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
                          title="Simulate shadow production traffic alongside incumbent"
                        >
                          Shadow Test
                        </button>
                      )}

                      {/* Canary test */}
                      {config.state === 'HOT' && (
                        <button
                          onClick={() => onCanaryTest(config.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium transition-colors"
                          title="Simulate progressive 5% → 100% traffic ramp-up"
                        >
                          Canary Test
                        </button>
                      )}

                      {/* Simulate Degradation (for HOT configs) */}
                      {config.state === 'HOT' && (
                        <button
                          onClick={() => onDegrade(config.id)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
                          title="Simulate quality degradation below 99% to trigger demotion and fallback"
                        >
                          Simulate Drop
                        </button>
                      )}

                      {/* Evidence */}
                      <button
                        onClick={() => onViewEvidence(config.id)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title="View stored qualification evidence"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
