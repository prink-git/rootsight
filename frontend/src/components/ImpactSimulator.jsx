import React, { useMemo } from 'react';
import { computeProjection } from '../utils/health';

function Delta({ before, after, invert }) {
  const diff = after - before;
  const good = invert ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.05) return <span style={styles.deltaFlat}>—</span>;
  const arrow = diff > 0 ? '↑' : '↓';
  return (
    <span style={{ ...styles.delta, color: good ? 'var(--sev-low)' : 'var(--sev-critical)' }}>
      {arrow} {Math.abs(Math.round(diff * 10) / 10)}
    </span>
  );
}

export default function ImpactSimulator({ clusters, plannedIds, health }) {
  const projection = useMemo(() => computeProjection(clusters, plannedIds), [clusters, plannedIds]);

  const rows = [
    {
      label: 'Support Health Score',
      before: health.health_score,
      after: projection.healthAfter,
      unit: '/100',
    },
    {
      label: 'Monthly ticket volume',
      before: projection.totalBefore,
      after: projection.totalAfter,
      unit: 'tickets',
      invert: true,
    },
    {
      label: 'Average CSAT',
      before: health.avg_csat,
      after: projection.avgCsatAfter,
      unit: '/5',
    },
    {
      label: 'Backlog friction score',
      before: health.friction_score,
      after: projection.frictionScoreAfter,
      unit: '/100',
      invert: true,
    },
  ];

  const maxTickets = Math.max(projection.totalBefore, 1);
  const noneSelected = plannedIds.size === 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>IMPACT SIMULATOR</span>
        <p style={styles.sub}>
          Projected outcome if the <strong>{plannedIds.size}</strong> fixes checked in the Action Center ship.
          Toggle fixes there to see this update live.
        </p>
      </div>

      {noneSelected ? (
        <div className="fade-in" style={styles.emptyState}>
          <span style={styles.emptyLabel}>NO FIXES SELECTED</span>
          <p style={styles.emptySub}>
            Check one or more root causes in the Action Center to see the projected before/after impact.
          </p>
        </div>
      ) : (
        <div key={plannedIds.size} className="fade-in">
          <div style={styles.heroStat}>
            <span style={styles.heroNum}>{projection.ticketsReduced}</span>
            <span style={styles.heroLabel}>fewer tickets / month</span>
            <span style={styles.heroPct}>({projection.pctReduced}% reduction)</span>
          </div>

          <div style={styles.barCompare}>
            <div style={styles.barRow}>
              <span style={styles.barLabel}>BEFORE</span>
              <div style={styles.track}>
                <div style={{ ...styles.fill, width: '100%', background: 'var(--text-tertiary)' }} />
              </div>
              <span style={styles.barVal}>{projection.totalBefore}</span>
            </div>
            <div style={styles.barRow}>
              <span style={styles.barLabel}>AFTER</span>
              <div style={styles.track}>
                <div
                  style={{
                    ...styles.fill,
                    width: `${(projection.totalAfter / maxTickets) * 100}%`,
                    background: 'var(--accent-teal)',
                  }}
                />
              </div>
              <span style={{ ...styles.barVal, color: 'var(--accent-teal)' }}>{projection.totalAfter}</span>
            </div>
          </div>

          <div style={styles.table}>
            <div style={styles.tableHead}>
              <span>METRIC</span>
              <span>BEFORE</span>
              <span>AFTER</span>
              <span>Δ</span>
            </div>
            {rows.map((r) => (
              <div key={r.label} style={styles.tableRow}>
                <span style={styles.metricLabel}>{r.label}</span>
                <span style={styles.metricVal}>{r.before}{r.unit}</span>
                <span style={{ ...styles.metricVal, color: 'var(--accent-teal)' }}>{r.after}{r.unit}</span>
                <Delta before={r.before} after={r.after} invert={r.invert} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: 24,
  },
  header: { marginBottom: 20 },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    textAlign: 'center',
    padding: '36px 20px',
    border: '1px dashed var(--border-strong)',
    borderRadius: 8,
  },
  emptyLabel: { fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-tertiary)' },
  emptySub: { fontSize: 13, color: 'var(--text-tertiary)', margin: 0, maxWidth: 360 },
  eyebrow: { fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.12em', color: 'var(--accent-teal)' },
  sub: { fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 0', maxWidth: 520 },
  heroStat: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '18px 0 22px',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  heroNum: { fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, color: 'var(--accent-teal)' },
  heroLabel: { fontSize: 15, color: 'var(--text-primary)' },
  heroPct: { fontSize: 13, color: 'var(--text-tertiary)' },
  barCompare: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 },
  barRow: { display: 'grid', gridTemplateColumns: '64px 1fr 50px', alignItems: 'center', gap: 12 },
  barLabel: { fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-tertiary)' },
  track: { height: 14, background: 'var(--bg-panel-raised)', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
  barVal: { fontFamily: 'var(--font-display)', fontSize: 13, textAlign: 'right' },
  table: { display: 'flex', flexDirection: 'column' },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 90px 70px',
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    padding: '0 4px 8px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 90px 70px',
    alignItems: 'center',
    padding: '11px 4px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  metricLabel: { fontSize: 13, color: 'var(--text-secondary)' },
  metricVal: { fontFamily: 'var(--font-display)', fontSize: 13 },
  delta: { fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600 },
  deltaFlat: { fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-tertiary)' },
};
