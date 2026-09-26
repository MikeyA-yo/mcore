import React from 'react';
import { Activity, RefreshCw, Zap, Server, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: 'overview' | 'configs' | 'traces' | 'evidence' | 'demo';
  setActiveTab: (tab: 'overview' | 'configs' | 'traces' | 'evidence' | 'demo') => void;
  onReset: () => void;
  isResetting: boolean;
  serverOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onReset,
  isResetting,
  serverOnline,
}) => {
  const tabs: Array<{
    id: 'overview' | 'configs' | 'traces' | 'evidence' | 'demo';
    label: string;
    badge?: string;
  }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'configs', label: 'Configurations' },
    { id: 'traces', label: 'Execution Traces' },
    { id: 'evidence', label: 'Evidence Store' },
    { id: 'demo', label: 'Primary Demo (PRD §32)', badge: 'Story' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                MeterCore
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              AI Workflow Cost Optimization Control Plane
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-150 flex items-center space-x-1.5 ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-500/10 shadow-sm border border-cyan-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-400 text-zinc-950 font-bold uppercase tracking-wider">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status & Actions */}
        <div className="flex items-center space-x-3">
          {/* Server status pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-zinc-800">
            <span
              className={`w-2 h-2 rounded-full ${
                serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] text-zinc-300 hidden md:inline">
              {serverOnline ? 'API Connected (:3001)' : 'Offline'}
            </span>
          </div>

          {/* Reset Baseline button */}
          <button
            onClick={onReset}
            disabled={isResetting}
            title="Reset storage to initial seed baseline"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Reset Baseline</span>
          </button>
        </div>
      </div>
    </header>
  );
};
