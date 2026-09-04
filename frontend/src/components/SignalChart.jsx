import React, { useState } from 'react';

const SEV_COLOR = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
};

const LEGEND = [
  { sev: 'critical', label: 'Critical' },
  { sev: 'high', label: 'High' },
  { sev: 'medium', label: 'Medium' },
  { sev: 'low', label: 'Low' },
];

export default function SignalChart({ clusters, onSelect, selectedId }) {
  const [hoveredId, setHoveredId] = useState(null);
  const maxSize = Math.max(...clusters.map((c) => c.size), 1);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <span style={styles.headerLabel}>SIGNAL READOUT</span>
          <span style={styles.headerSub}>backlog share by root cause</span>
        </div>
        <div style={styles.legend}>
          {LEGEND.map((l) => (
            <span key={l.sev} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: SEV_COLOR[l.sev] }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="fade-in-stagger" style={styles.bars}>
        {clusters.map((c, i) => {
          const sev = c.ai?.severity || 'medium';
          const color = SEV_COLOR[sev] || SEV_COLOR.medium;
          const widthPct = (c.size / maxSize) * 100;
          const isSelected = selectedId === c.cluster_id;
          const isHovered = hoveredId === c.cluster_id;
          return (
            <button
              key={c.cluster_id}
              onClick={() => onSelect(c.cluster_id)}
              onMouseEnter={() => setHoveredId(c.cluster_id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                ...styles.row,
                background: isSelected
                  ? 'var(--bg-panel-hover)'
                  : isHovered
                  ? 'rgba(255,255,255,0.03)'
                  : 'transparent',
                borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
              }}
            >
              <span style={styles.rowIndex}>{String(i + 1).padStart(2, '0')}</span>
              <span style={styles.rowLabel} title={c.ai?.root_cause_label}>
                {c.ai?.root_cause_label || `Cluster ${c.cluster_id}`}
              </span>
              <span style={styles.trackWrap}>
                <span style={styles.track}>
                  <span
                    style={{
                      ...styles.fill,
                      width: `${widthPct}%`,
                      background: color,
                      boxShadow: isSelected || isHovered ? `0 0 12px ${color}` : 'none',
                    }}
                  />
                </span>
              </span>
              <span style={styles.rowStat}>{c.size}</span>
              <span style={styles.rowPct}>{c.pct_of_total}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '20px 20px 12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  headerLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    letterSpacing: '0.12em',
    color: 'var(--accent-teal)',
    fontWeight: 600,
    marginRight: 10,
  },
  headerSub: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
  },
  legend: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: 'var(--text-tertiary)',
  },
  legendDot: { width: 6, height: 6, borderRadius: '50%' },
  bars: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr 200px 40px 48px',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '9px 8px',
    border: 'none',
    borderBottom: '1px solid var(--border-subtle)',
    borderRadius: 4,
    color: 'inherit',
    textAlign: 'left',
  },
  rowIndex: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    color: 'var(--text-tertiary)',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  track: {
    position: 'relative',
    height: 6,
    width: '100%',
    background: 'var(--bg-panel-raised)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    transition: 'width 0.5s cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 0.15s ease',
  },
  rowStat: {
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    color: 'var(--text-primary)',
    textAlign: 'right',
  },
  rowPct: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    color: 'var(--text-tertiary)',
    textAlign: 'right',
  },
};
