import React, { useState, useEffect, useRef } from 'react';
import { fetchAnalysis, fetchHealth } from './api';
import SignalChart from './components/SignalChart';
import ClusterDetail from './components/ClusterDetail';
import HealthStrip from './components/HealthStrip';
import ActionCenter from './components/ActionCenter';
import ImpactSimulator from './components/ImpactSimulator';
import ChatWidget from './components/ChatWidget';

const TABS = [
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'action', label: 'Action Center' },
  { id: 'impact', label: 'Impact Simulator' },
];

const LOADING_STEPS = [
  'Clustering ticket backlog…',
  'Sampling representative tickets…',
  'Local model generating root-cause reports…',
  'Scoring priority and expected impact…',
];

export default function App() {
  const [analysis, setAnalysis] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('diagnostics');
  const [plannedIds, setPlannedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lmConnected, setLmConnected] = useState(null); // null = unknown yet
  const [modelProvider, setModelProvider] = useState('model provider');
  const [lmModel, setLmModel] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimerRef = useRef(null);

  async function load(refresh = false) {
    if (loading) return; // guard against overlapping calls from un-throttled retry buttons
    setLoading(true);
    setError(null);
    setStepIndex(0);
    clearInterval(stepTimerRef.current);
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 2200);

    try {
      const data = await fetchAnalysis(refresh);
      setAnalysis(data);
      if (data.clusters?.length) {
        setSelectedId((prev) => {
          const stillValid = prev !== null && data.clusters.some((c) => c.cluster_id === prev);
          return stillValid ? prev : data.clusters[0].cluster_id;
        });
        // default: every recommended fix is "planned" so Impact starts by
        // showing the full best-case story; users can then deselect.
        setPlannedIds(new Set(data.clusters.map((c) => c.cluster_id)));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(stepTimerRef.current);
      setLoading(false);
    }
  }

  async function checkHealth() {
    try {
      const h = await fetchHealth();
      setLmConnected(!!h.model_connected);
      setModelProvider(h.provider || 'model provider');
      setLmModel(h.model || null);
    } catch {
      setLmConnected(false);
    }
  }

  useEffect(() => {
    load(false);
    checkHealth();
    const poll = setInterval(checkHealth, 15_000);
    return () => {
      clearInterval(poll);
      clearInterval(stepTimerRef.current);
    };
  }, []);

  const selectedCluster = analysis?.clusters?.find((c) => c.cluster_id === selectedId) || null;
  const hasClusters = analysis?.clusters?.length > 0;

  function togglePlanned(id) {
    setPlannedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="console-bg" style={styles.page}>
      <header className="app-header" style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>◈</span>
          <span style={styles.brandName}>ROOTSIGHT AI</span>
          <span style={styles.brandTag}>root-cause intelligence console</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.connBadge} title={lmModel ? `Model: ${lmModel}` : undefined}>
            <span
              style={{
                ...styles.connDot,
                background:
                  lmConnected === null ? 'var(--text-tertiary)' :
                  lmConnected ? 'var(--sev-low)' : 'var(--sev-critical)',
              }}
              className={lmConnected ? 'pulse' : ''}
            />
            {lmConnected === null ? `checking ${modelProvider}…` : lmConnected ? `${modelProvider} connected` : `${modelProvider} offline`}
          </span>
          <button style={styles.refreshBtn} onClick={() => load(true)} disabled={loading}>
            {loading ? (<><span className="spin">↻</span> ANALYZING…</>) : '↻ RE-RUN ANALYSIS'}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && (
          <div className="fade-in" style={styles.errorBox}>
            <div>
              <strong style={styles.errorTitle}>Couldn't reach the analysis engine</strong>
              <p style={styles.errorDetail}>{error}</p>
              <p style={styles.errorHint}>
                Check that the backend is running on :8000 and the configured model provider is
                available.
              </p>
            </div>
            <button style={styles.retryBtn} onClick={() => load(analysis ? true : false)}>
              ↻ Retry
            </button>
          </div>
        )}

        {loading && !analysis && (
          <div className="fade-in" style={styles.loadingBox}>
            <span style={styles.loadingLabel}>RUNNING ROOT-CAUSE ANALYSIS</span>
            <div style={styles.loadingTrackWrap}>
              <div className="progress-track" />
            </div>
            <span style={styles.loadingSub} key={stepIndex}>
              {LOADING_STEPS[stepIndex]}
            </span>
            <span style={styles.loadingNote}>
              First run takes longer - the local model is analyzing each root cause individually.
            </span>
          </div>
        )}

        {!loading && !error && analysis && !hasClusters && (
          <div className="fade-in" style={styles.emptyBox}>
            <span style={styles.emptyLabel}>NO ROOT CAUSES FOUND</span>
            <p style={styles.emptySub}>
              The analysis ran but found no ticket clusters. Check that
              <code style={styles.code}> backend/data/tickets.csv</code> has data, then re-run.
            </p>
            <button style={styles.retryBtn} onClick={() => load(true)}>↻ Re-run analysis</button>
          </div>
        )}

        {analysis && hasClusters && (
          <>
            <div className="fade-in">
              <HealthStrip analysis={analysis} />
            </div>

            <nav style={styles.tabs}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    ...styles.tabBtn,
                    ...(tab === t.id ? styles.tabBtnActive : {}),
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div key={tab} className="fade-in">
              {tab === 'diagnostics' && (
                <div className="app-grid" style={styles.grid}>
                  <SignalChart
                    clusters={analysis.clusters}
                    onSelect={setSelectedId}
                    selectedId={selectedId}
                  />
                  <ClusterDetail cluster={selectedCluster} />
                </div>
              )}

              {tab === 'action' && (
                <ActionCenter
                  clusters={analysis.clusters}
                  plannedIds={plannedIds}
                  onToggle={togglePlanned}
                />
              )}

              {tab === 'impact' && (
                <ImpactSimulator
                  clusters={analysis.clusters}
                  plannedIds={plannedIds}
                  health={analysis.health}
                />
              )}
            </div>
          </>
        )}
      </main>

      <ChatWidget />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 32px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'rgba(11, 15, 20, 0.85)',
    backdropFilter: 'blur(6px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: { display: 'flex', alignItems: 'baseline', gap: 10 },
  brandMark: { color: 'var(--accent-amber)', fontSize: 18 },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  brandTag: { fontSize: 12, color: 'var(--text-tertiary)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 14 },
  connBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontFamily: 'var(--font-display)',
    color: 'var(--text-tertiary)',
  },
  connDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  refreshBtn: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: '0.06em',
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--border-strong)',
    color: 'var(--accent-teal)',
    padding: '8px 14px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  main: {
    flex: 1,
    padding: '28px 32px 60px',
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
  },
  tabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
    borderBottom: '1px solid var(--border-subtle)',
  },
  tabBtn: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    letterSpacing: '0.04em',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-tertiary)',
    padding: '10px 4px',
    marginRight: 18,
  },
  tabBtnActive: {
    color: 'var(--accent-amber)',
    borderBottom: '2px solid var(--accent-amber)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  },
  errorBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    background: 'rgba(229,72,77,0.08)',
    border: '1px solid var(--sev-critical)',
    color: 'var(--text-primary)',
    padding: '16px 20px',
    borderRadius: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  errorTitle: { fontSize: 14, display: 'block', marginBottom: 4 },
  errorDetail: { fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 4px', fontFamily: 'var(--font-display)' },
  errorHint: { fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0 },
  retryBtn: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--sev-critical)',
    color: 'var(--sev-critical)',
    padding: '9px 16px',
    borderRadius: 6,
    flexShrink: 0,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    textAlign: 'center',
  },
  loadingLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    letterSpacing: '0.1em',
    color: 'var(--accent-amber)',
  },
  loadingTrackWrap: { width: 280, maxWidth: '80vw' },
  loadingSub: { fontSize: 13, color: 'var(--text-secondary)', animation: 'fadeIn 0.4s ease' },
  loadingNote: { fontSize: 11.5, color: 'var(--text-tertiary)', maxWidth: 340 },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    textAlign: 'center',
    border: '1px dashed var(--border-strong)',
    borderRadius: 8,
    padding: 40,
  },
  emptyLabel: { fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-tertiary)' },
  emptySub: { fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 380 },
  code: {
    fontFamily: 'var(--font-display)',
    background: 'var(--bg-panel-raised)',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 12,
  },
};
