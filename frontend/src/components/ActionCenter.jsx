import React, { useState } from 'react';
import ActionStepsList from './ActionStepsList';

const PRIORITY_COLOR = {
  P0: 'var(--sev-critical)',
  P1: 'var(--sev-high)',
  P2: 'var(--sev-medium)',
  P3: 'var(--sev-low)',
};

export default function ActionCenter({ clusters, plannedIds, onToggle }) {
  const [expandedId, setExpandedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  if (!clusters?.length) {
    return (
      <div style={styles.wrap}>
        <div style={styles.emptyState}>
          <span style={styles.emptyLabel}>NO ACTIONS TO SHOW</span>
          <p style={styles.emptySub}>Run the analysis first to generate a prioritized fix list.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>AI ACTION CENTER</span>
          <p style={styles.sub}>Every root cause, ranked by impact, with a concrete fix and an owner already assigned.</p>
        </div>
        <span style={styles.countBadge}>{plannedIds.size} / {clusters.length} planned</span>
      </div>

      <div style={styles.tableHead}>
        <span></span>
        <span></span>
        <span>PRIORITY</span>
        <span>ROOT CAUSE</span>
        <span>EXPECTED REDUCTION</span>
        <span>OWNER TEAM</span>
      </div>

      <div className="fade-in-stagger" style={styles.rows}>
        {clusters.map((c) => {
          const ai = c.ai || {};
          const isExpanded = expandedId === c.cluster_id;
          const isPlanned = plannedIds.has(c.cluster_id);
          const isHovered = hoveredId === c.cluster_id;
          const color = PRIORITY_COLOR[c.priority] || PRIORITY_COLOR.P2;
          return (
            <div
              key={c.cluster_id}
              style={{
                ...styles.rowWrap,
                borderLeft: `3px solid ${color}`,
                background: isHovered ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}
              onMouseEnter={() => setHoveredId(c.cluster_id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={styles.row}>
                <label style={styles.checkboxWrap} title="Include in impact simulation">
                  <input
                    type="checkbox"
                    checked={isPlanned}
                    onChange={() => onToggle(c.cluster_id)}
                    style={styles.checkbox}
                  />
                </label>
                <button
                  style={styles.expandChevron}
                  onClick={() => setExpandedId(isExpanded ? null : c.cluster_id)}
                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                >
                  <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    ›
                  </span>
                </button>
                <span style={{ ...styles.priorityTag, color, borderColor: color }}>{c.priority}</span>
                <button
                  style={styles.rootCauseBtn}
                  onClick={() => setExpandedId(isExpanded ? null : c.cluster_id)}
                >
                  <span style={styles.rootCauseLabel}>{ai.root_cause_label}</span>
                  <span style={styles.rootCauseMeta}>{c.size} tickets · {c.pct_of_total}% of backlog</span>
                </button>
                <span style={styles.reduction}>
                  <span style={styles.reductionNum}>{c.expected_reduction_tickets}</span>
                  <span style={styles.reductionUnit}>tickets</span>
                </span>
                <span style={styles.owner}>{ai.owner_team}</span>
              </div>
              {isExpanded && (
                <div className="fade-in" style={styles.expanded}>
                  <div style={styles.expandedCol}>
                    <span style={styles.expandedLabel}>ROOT CAUSE</span>
                    <p style={styles.expandedText}>{ai.root_cause_explanation}</p>
                  </div>
                  <div style={styles.expandedCol}>
                    <span style={styles.expandedLabel}>ACTION PLAN</span>
                    <ActionStepsList text={ai.recommended_fix} compact />
                  </div>
                </div>
              )}
            </div>
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
    padding: 24,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyLabel: { fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-tertiary)' },
  emptySub: { fontSize: 13, color: 'var(--text-tertiary)', margin: 0 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 10,
  },
  eyebrow: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    letterSpacing: '0.12em',
    color: 'var(--accent-teal)',
  },
  sub: { fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 0', maxWidth: 460 },
  countBadge: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    color: 'var(--accent-amber)',
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--border-subtle)',
    padding: '5px 10px',
    borderRadius: 5,
    whiteSpace: 'nowrap',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '30px 20px 70px 1fr 140px 160px',
    gap: 12,
    padding: '0 10px 10px',
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  rows: { display: 'flex', flexDirection: 'column' },
  rowWrap: { borderBottom: '1px solid var(--border-subtle)' },
  row: {
    display: 'grid',
    gridTemplateColumns: '30px 20px 70px 1fr 140px 160px',
    gap: 12,
    alignItems: 'center',
    padding: '12px 10px',
  },
  checkboxWrap: { display: 'flex', justifyContent: 'center' },
  checkbox: { width: 15, height: 15, accentColor: 'var(--accent-teal)' },
  expandChevron: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: 16,
    padding: 0,
    lineHeight: 1,
  },
  priorityTag: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 3,
    border: '1px solid',
    textAlign: 'center',
    width: 'fit-content',
  },
  rootCauseBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    textAlign: 'left',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  rootCauseLabel: { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' },
  rootCauseMeta: { fontSize: 11, color: 'var(--text-tertiary)' },
  reduction: { display: 'flex', alignItems: 'baseline', gap: 5 },
  reductionNum: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-teal)' },
  reductionUnit: { fontSize: 11, color: 'var(--text-tertiary)' },
  owner: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-panel-raised)',
    padding: '4px 10px',
    borderRadius: 4,
    width: 'fit-content',
  },
  expanded: {
    display: 'flex',
    gap: 24,
    padding: '4px 10px 16px 72px',
    flexWrap: 'wrap',
  },
  expandedCol: { flex: 1, minWidth: 220 },
  expandedLabel: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'var(--accent-amber)',
    marginBottom: 5,
  },
  expandedText: { fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 },
};
