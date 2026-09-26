import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Hash,
  Activity,
  Layers,
  FileCheck,
  Search,
} from 'lucide-react';
import type { QualificationEvidence } from '../lib/api';

interface EvidenceInspectorProps {
  evidenceList: QualificationEvidence[];
  selectedConfigId?: string | null;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  evidenceList,
  selectedConfigId,
}) => {
  const [searchTerm, setSearchTerm] = useState(selectedConfigId || '');

  const filtered = evidenceList.filter((e) => {
    if (!searchTerm) return true;
    return (
      e.configId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.decision.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.datasetId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>Qualification Evidence Store</span>
          </h2>
          <p className="text-xs text-zinc-400">
            PRD Principle 3: "Evidence precedes trust. A cheaper configuration earns production eligibility through evidence."
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by config or decision..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* Evidence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((evidence) => {
          const isPromote = evidence.decision === 'PROMOTE';
          const lowerCI = (evidence.confidenceInterval?.lower * 100 || 0).toFixed(2);
          const upperCI = (evidence.confidenceInterval?.upper * 100 || 0).toFixed(2);

          return (
            <div
              key={evidence.id}
              className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-zinc-100">
                    {evidence.configId}
                  </span>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    ID: {evidence.id}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                    isPromote
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {evidence.decision} ({evidence.fromState} → {evidence.toState})
                </span>
              </div>

              {/* Statistical Proof Badges */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Quality CI (95%)</div>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {lowerCI}% – {upperCI}%
                  </div>
                </div>

                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Critical Fails</div>
                  <div
                    className={`font-mono font-bold mt-0.5 ${
                      evidence.criticalFailures === 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {evidence.criticalFailures}
                  </div>
                </div>

                <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Latency P95</div>
                  <div className="font-mono font-bold text-zinc-300 mt-0.5">
                    {evidence.p95LatencyMs} ms
                  </div>
                </div>
              </div>

              {/* Justification & metadata */}
              <div className="text-xs text-zinc-300 bg-zinc-950/70 p-2.5 rounded border border-zinc-800/80">
                <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                  Audited Justification:
                </span>
                <p className="mt-0.5">{evidence.reason}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
                <span>Evaluator: {evidence.evaluatorVersion}</span>
                <span>Dataset: {evidence.datasetId} ({evidence.runs} runs)</span>
                <span>Expires: {new Date(evidence.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-zinc-500 text-sm">
            No qualification evidence records match the current filter.
          </div>
        )}
      </div>
    </div>
  );
};
