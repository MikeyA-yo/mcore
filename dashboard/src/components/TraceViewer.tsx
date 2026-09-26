import React, { useState } from 'react';
import {
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  Wand2,
  Cpu,
  Layers,
  Clock,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
  Terminal,
} from 'lucide-react';
import type { Trace, TraceEvent } from '../lib/api';

interface TraceViewerProps {
  traces: Trace[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string) => void;
  loading: boolean;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({
  traces,
  selectedTraceId,
  onSelectTrace,
  loading,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedTrace = traces.find((t) => t.id === selectedTraceId) || traces[0];
  const selectedEvent = selectedTrace?.events?.find((e) => e.id === selectedEventId);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'INPUT_ANALYSIS':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'COST_ESTIMATION':
        return <DollarSign className="w-4 h-4 text-amber-400" />;
      case 'CANDIDATE_EVALUATION':
        return <CheckCircle className="w-4 h-4 text-indigo-400" />;
      case 'POST_TRAINING_SIMULATION':
        return <Wand2 className="w-4 h-4 text-purple-400" />;
      case 'SHADOW_QUALIFICATION':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'ALLOCATION':
        return <Layers className="w-4 h-4 text-green-400" />;
      case 'SAVINGS_ESTIMATE':
        return <TrendingDown className="w-4 h-4 text-emerald-300" />;
      default:
        return <Cpu className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Trace List */}
      <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm text-zinc-200">Execution Traces</span>
          </div>
          <span className="text-xs font-mono text-zinc-500">{traces.length} traces</span>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {traces.map((trace) => {
            const isSelected = trace.id === (selectedTrace?.id || selectedTraceId);
            const dateStr = new Date(trace.startTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <button
                key={trace.id}
                onClick={() => {
                  onSelectTrace(trace.id);
                  setSelectedEventId(null);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-zinc-100 shadow-sm'
                    : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-zinc-200">
                    {trace.id}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      trace.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {trace.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>{trace.workflowId}</span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{dateStr}</span>
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-400">
                  {trace.events?.length || 0} lifecycle events recorded
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right 2 Columns: Trace Lifecycle Timeline & Inspector */}
      <div className="lg:col-span-2 space-y-4">
        {selectedTrace ? (
          <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-base text-zinc-100">
                    {selectedTrace.id}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {selectedTrace.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Workflow: <span className="text-zinc-200 font-mono">{selectedTrace.workflowId}</span>
                </p>
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                Started: {new Date(selectedTrace.startTime).toLocaleString()}
              </div>
            </div>

            {/* Visual Timeline Tree */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Decision Lifecycle Waterfall
              </h3>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {selectedTrace.events?.map((event, idx) => {
                  const isEventSelected = event.id === (selectedEvent?.id || selectedEventId);

                  return (
                    <div
                      key={event.id || idx}
                      onClick={() => setSelectedEventId(event.id)}
                      className={`relative p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isEventSelected
                          ? 'bg-zinc-800/80 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                          : 'bg-zinc-950/70 border-zinc-800/80 hover:bg-zinc-800/40 hover:border-zinc-700'
                      }`}
                    >
                      {/* Node circle on vertical line */}
                      <div className="absolute -left-6 top-4 w-3.5 h-3.5 rounded-full bg-zinc-900 border-2 border-cyan-400 flex items-center justify-center -translate-x-1/2" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          {getEventIcon(event.type)}
                          <span className="font-mono font-semibold text-xs sm:text-sm text-zinc-200">
                            {event.type}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Brief Event Summary Highlights */}
                      <div className="mt-2 text-xs font-mono text-zinc-400">
                        {event.type === 'INPUT_ANALYSIS' && (
                          <div className="text-zinc-300">
                            Tokens: <span className="text-cyan-400">{event.data?.estimatedTokens} input</span>,{' '}
                            <span className="text-cyan-400">{event.data?.outputTokens} output</span>
                          </div>
                        )}
                        {event.type === 'COST_ESTIMATION' && (
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {Object.entries(event.data || {}).map(([cfg, cost]) => (
                              <span key={cfg} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                                {cfg}: <span className="text-amber-400">{String(cost)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {event.type === 'CANDIDATE_EVALUATION' && (
                          <div>
                            Candidate: <span className="text-zinc-200">{event.data?.configId}</span> →{' '}
                            <span
                              className={
                                event.data?.decision === 'PROMOTE' ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {event.data?.decision}
                            </span>{' '}
                            (Quality: {(Number(event.data?.quality || 0) * 100).toFixed(1)}%)
                          </div>
                        )}
                        {event.type === 'POST_TRAINING_SIMULATION' && (
                          <div className="text-purple-300">
                            Simulated TRL: {event.data?.originalConfigId} →{' '}
                            <span className="text-purple-400 font-semibold">{event.data?.newConfigId}</span>{' '}
                            (Quality: {(Number(event.data?.qualityBefore || 0) * 100).toFixed(1)}% →{' '}
                            {(Number(event.data?.qualityAfter || 0) * 100).toFixed(1)}%)
                          </div>
                        )}
                        {event.type === 'ALLOCATION' && (
                          <div className="text-emerald-400">
                            Selected Primary: <span className="font-bold">{event.data?.selectedConfigId}</span>
                            {event.data?.fallback?.length > 0 && (
                              <span className="text-zinc-400"> (Fallback: {event.data.fallback.join(', ')})</span>
                            )}
                          </div>
                        )}
                        {event.type === 'SAVINGS_ESTIMATE' && (
                          <div className="text-emerald-300 font-bold">
                            Savings: {Number(event.data?.savingsPercent || 0).toFixed(1)}% reduction per case
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event JSON Raw Payload Modal / Drawer */}
            {selectedEvent && (
              <div className="mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-cyan-400 font-semibold">
                    Payload: {selectedEvent.type}
                  </span>
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs"
                  >
                    Close Payload
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-900 p-3 rounded overflow-x-auto">
                  {JSON.stringify(selectedEvent.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-12 text-center text-zinc-500">
            No execution trace selected. Run an optimization to generate traces.
          </div>
        )}
      </div>
    </div>
  );
};
