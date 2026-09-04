import React from 'react';

function scoreColor(score) {
  if (score >= 70) return 'var(--sev-low)';
  if (score >= 45) return 'var(--sev-medium)';
  return 'var(--sev-critical)';
}

export default function HealthStrip({ analysis }) {
  if (!analysis) return null;
  const { health, headline_stat, total_tickets } = analysis;
  const color = scoreColor(health.health_score);
  const pct = Math.max(0, Math.min(100, health.health_score));

  const metrics = [
    { label: 'root causes found', value: health.root_causes_found },
    { label: 'tickets analyzed', value: total_tickets },
    { label: 'backlog deflectable', value: `${health.pct_deflectable}%` },
    { label: 'high/critical issues', value: health.high_critical_count },
    { label: 'avg CSAT', value: health.avg_csat },
  ];

  return (
    <div style={styles.wrap}>
      <div style={styles.scoreBlock}>
        <div
          style={{
            ...styles.gauge,
            background: `conic-gradient(${color} ${pct * 3.6}deg, var(--bg-panel-raised) 0deg)`,
          }}
        >
          <div style={styles.gaugeInner}>
            <span style={{ ...styles.gaugeNum, color }}>{health.health_score}</span>
            <span style={styles.gaugeMax}>/100</span>
          </div>
        </div>
        <div>
          <span style={styles.scoreLabel}>SUPPORT HEALTH SCORE</span>
          <p style={styles.scoreSub}>
            <span style={styles.bigNum}>{headline_stat.top_n}</span> root causes explain{' '}
            <span style={{ ...styles.bigNum, color: 'var(--accent-amber)' }}>{headline_stat.pct_of_backlog}%</span> of the backlog.
          </p>
        </div>
      </div>

      <div className="fade-in-stagger" style={styles.metrics}>
        {metrics.map((m) => (
          <div key={m.label} style={styles.metricTile}>
            <span style={styles.metricValue}>{m.value}</span>
            <span style={styles.metricLabel}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 24,
    alignItems: 'center',
    background: 'linear-gradient(135deg, var(--bg-panel-raised), var(--bg-panel))',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '20px 26px',
    marginBottom: 20,
  },
  scoreBlock: { display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 },
  gauge: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.6s ease',
  },
  gaugeInner: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeNum: { fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, lineHeight: 1 },
  gaugeMax: { fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-tertiary)' },
  scoreLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: '0.12em',
    color: 'var(--accent-teal)',
    display: 'block',
    marginBottom: 4,
  },
  scoreSub: { fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 320 },
  bigNum: { fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' },
  metrics: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
    borderLeft: '1px solid var(--border-subtle)',
    paddingLeft: 24,
    flex: 1,
  },
  metricTile: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 },
  metricValue: { fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 },
  metricLabel: { fontSize: 11, color: 'var(--text-tertiary)' },
};
