import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  type OverviewMetrics,
  type ExecutionConfiguration,
  type Trace,
  type QualificationEvidence,
} from './lib/api';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { ConfigurationsTable } from './components/ConfigurationsTable';
import { TraceViewer } from './components/TraceViewer';
import { EvidenceInspector } from './components/EvidenceInspector';
import { SavingsChart } from './components/SavingsChart';
import { DemoWalkthrough } from './components/DemoWalkthrough';
import { Play, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'configs' | 'traces' | 'evidence' | 'demo'>('overview');
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [configs, setConfigs] = useState<ExecutionConfiguration[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [evidenceList, setEvidenceList] = useState<QualificationEvidence[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [evidenceConfigFilter, setEvidenceConfigFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quick optimization input in overview
  const [customInputText, setCustomInputText] = useState(
    'Customer was charged twice for order #4821. They want a refund for the duplicate.'
  );
  const [isOptimizing, setIsOptimizing] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadAllData = useCallback(async () => {
    try {
      const [overviewData, configsData, tracesData, evidenceData] = await Promise.all([
        api.getOverview(),
        api.getConfigurations(),
        api.getTraces(20),
        api.getEvidence(),
      ]);

      setMetrics(overviewData);
      setConfigs(configsData);
      setTraces(tracesData);
      setEvidenceList(evidenceData);
      setServerOnline(true);
      if (!selectedTraceId && tracesData.length > 0) {
        setSelectedTraceId(tracesData[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load API data:', err);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  }, [selectedTraceId]);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [loadAllData]);

  // Action handlers
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await api.initData();
      await loadAllData();
      showNotification('success', 'Baseline storage re-initialized to initial seed state.');
    } catch (err: any) {
      showNotification('error', `Reset failed: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleShadowTest = async (configId: string) => {
    setLoadingAction(configId);
    try {
      const res = await api.shadowTest(configId);
      await loadAllData();
      if (res.promotedToHot) {
        showNotification('success', `✓ ${configId} passed shadow traffic and was PROMOTED to HOT!`);
      } else {
        showNotification('error', `✗ ${configId} did not qualify in shadow mode: ${res.reason}`);
      }
    } catch (err: any) {
      showNotification('error', `Shadow simulation error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCanaryTest = async (configId: string) => {
    setLoadingAction(configId);
    try {
      const res = await api.canaryTest(configId);
      await loadAllData();
      if (res.status === 'PASSED') {
        showNotification('success', `✓ Canary deployment passed across all ramp-up steps!`);
      } else {
        showNotification('error', `✗ Canary safety breach: ${res.reason}`);
      }
    } catch (err: any) {
      showNotification('error', `Canary error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleQualify = async (configId: string) => {
    setLoadingAction(configId);
    try {
      const res = await api.qualify(configId);
      await loadAllData();
      if (res.decision === 'PROMOTE') {
        showNotification('success', `✓ ${configId} qualified and promoted (${res.fromState} → ${res.toState})`);
      } else {
        showNotification('error', `✗ ${configId} rejected: ${res.evidence.reason}`);
      }
    } catch (err: any) {
      showNotification('error', `Qualification error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDegrade = async (configId: string) => {
    setLoadingAction(configId);
    try {
      const res = await api.simulateDegradation(configId, 0.982);
      await loadAllData();
      showNotification(
        'error',
        `⚠️ Quality dropped to 98.2%! DEMOTED. Immediate fallback engaged: ${res.fallbackSelectedId}`
      );
    } catch (err: any) {
      showNotification('error', `Degradation simulation error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleQuickOptimize = async () => {
    if (!customInputText.trim()) return;
    setIsOptimizing(true);
    try {
      const res = await api.optimize(customInputText);
      await loadAllData();
      setSelectedTraceId(res.traceId);
      showNotification(
        'success',
        `🚀 Optimization complete! Trace: ${res.traceId} (Savings: ${res.estimatedSavings?.savingsPercent}%)`
      );
    } catch (err: any) {
      showNotification('error', `Optimization failed: ${err.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
        isResetting={isResetting}
        serverOnline={serverOnline}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom duration-300">
          <div
            className={`p-4 rounded-xl border shadow-2xl flex items-start space-x-3 ${
              notification.type === 'success'
                ? 'bg-zinc-900 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900 border-rose-500/40 text-rose-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="text-xs font-medium leading-relaxed">
              {notification.message}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <MetricCards metrics={metrics} loading={loading} />

            {/* Quick Live Optimization Sandbox Box */}
            <div className="glass-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Run Optimization Pipeline on Request</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Triggers the complete control loop: Input Analysis → Candidate Discovery → Qualification → TRL Adaptation → Shadow → Allocation.
                  </p>
                </div>
                <button
                  onClick={handleQuickOptimize}
                  disabled={isOptimizing}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isOptimizing ? 'animate-spin' : ''}`} />
                  <span>{isOptimizing ? 'Optimizing...' : 'Run Optimize'}</span>
                </button>
              </div>

              <textarea
                value={customInputText}
                onChange={(e) => setCustomInputText(e.target.value)}
                rows={2}
                placeholder="Paste customer support query or workflow input text..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Savings & Economics Chart */}
            <SavingsChart configs={configs} />

            {/* Configurations Table summary */}
            <ConfigurationsTable
              configs={configs}
              onShadowTest={handleShadowTest}
              onCanaryTest={handleCanaryTest}
              onQualify={handleQualify}
              onDegrade={handleDegrade}
              onViewEvidence={(cfgId) => {
                setEvidenceConfigFilter(cfgId);
                setActiveTab('evidence');
              }}
              loadingAction={loadingAction}
            />
          </div>
        )}

        {/* TAB 2: CONFIGURATIONS */}
        {activeTab === 'configs' && (
          <ConfigurationsTable
            configs={configs}
            onShadowTest={handleShadowTest}
            onCanaryTest={handleCanaryTest}
            onQualify={handleQualify}
            onDegrade={handleDegrade}
            onViewEvidence={(cfgId) => {
              setEvidenceConfigFilter(cfgId);
              setActiveTab('evidence');
            }}
            loadingAction={loadingAction}
          />
        )}

        {/* TAB 3: TRACES */}
        {activeTab === 'traces' && (
          <TraceViewer
            traces={traces}
            selectedTraceId={selectedTraceId}
            onSelectTrace={(tId) => setSelectedTraceId(tId)}
            loading={loading}
          />
        )}

        {/* TAB 4: EVIDENCE */}
        {activeTab === 'evidence' && (
          <EvidenceInspector
            evidenceList={evidenceList}
            selectedConfigId={evidenceConfigFilter}
          />
        )}

        {/* TAB 5: DEMO STORYBOARD */}
        {activeTab === 'demo' && (
          <DemoWalkthrough
            onRefreshAll={loadAllData}
            onSelectTrace={(traceId) => {
              setSelectedTraceId(traceId);
              setActiveTab('traces');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/60 py-6 text-center text-xs text-zinc-600">
        <p>MeterCore AI Workflow Cost Optimization Simulator · Local-First Control Plane</p>
      </footer>
    </div>
  );
}

export default App;
