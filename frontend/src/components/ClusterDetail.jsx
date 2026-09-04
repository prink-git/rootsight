import React, { useState } from 'react';
import ActionStepsList from './ActionStepsList';

const SEV_COLOR = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
};

export default function ClusterDetail({ cluster }) {
  const [showTickets, setShowTickets] = useState(false);
  if (!cluster) {
    return (
      <div style={styles.empty}>
        <span style={styles.emptyIcon}>◈</span>
        <span style={styles.emptyLabel}>SELECT A ROOT CAUSE</span>
        <span style={styles.emptySub}>Choose an entry from the signal readout to see the full autopsy.</span>
      </div>
    );
  }

  const ai = cluster.ai || {};
  const sev = ai.severity || 'medium';
  const color = SEV_COLOR[sev] || SEV_COLOR.medium;
  const deflection = parseFloat(String(ai.estimated_deflection_pct || '0').replace('%', '')) || 0;

  return (
    <div key={cluster.cluster_id} className="fade-in" style={styles.wrap}>
      <div style={{ ...styles.sevBar, background: color }} />
      <div style={styles.body}>
        <div style={styles.topRow}>
          {cluster.priority && (
            <span style={{ ...styles.priorityTag, color, borderColor: color }}>{cluster.priority}</span>
          )}
          <span style={{ ...styles.sevTag, color, borderColor: color }}>{sev.toUpperCase()}</span>
          <span style={styles.ownerTag}>{ai.owner_team || 'Unassigned'}</span>
        </div>

        <h2 style={styles.title}>{ai.root_cause_label}</h2>

        <div style={styles.statRow}>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{cluster.size}</span>
            <span style={styles.statLabel}>tickets</span>
          </div>
          <div style={styles.statBlock}>
            <span style={styles.statValue}>{cluster.pct_of_total}%</span>
            <span style={styles.statLabel}>of backlog</span>
          </div>
          <div style={styles.statBlock}>
            <span style={{ ...styles.statValue, color: 'var(--accent-teal)' }}>{deflection}%</span>
            <span style={styles.statLabel}>deflectable</span>
          </div>
          <div style={styles.statBlock}>
            <span style={{ ...styles.statValue, color: 'var(--accent-amber)' }}>{cluster.expected_reduction_tickets ?? '—'}</span>
            <span style={styles.statLabel}>tickets saved</span>
          </div>
        </div>

        <section style={styles.section}>
          <span style={styles.sectionLabel}>ROOT CAUSE</span>
          <p style={styles.sectionText}>{ai.root_cause_explanation}</p>
        </section>

        <section style={styles.section}>
          <span style={styles.sectionLabel}>RECOMMENDED FIX</span>
          <ActionStepsList text={ai.recommended_fix} />
        </section>

        <section style={styles.section}>
          <span style={styles.sectionLabel}>SIGNAL TERMS</span>
          <div style={styles.terms}>
            {cluster.top_terms?.slice(0, 6).map((t) => (
              <span key={t} style={styles.term}>{t}</span>
            ))}
          </div>
        </section>

        <button style={styles.toggleBtn} onClick={() => setShowTickets((s) => !s)}>
          {showTickets ? '− Hide sample tickets' : `+ View ${cluster.sample_tickets?.length || 0} sample tickets`}
        </button>

        {showTickets && (
          <div className="fade-in-stagger" style={styles.tickets}>
            {cluster.sample_tickets?.map((t) => (
              <div key={t.ticket_id} style={styles.ticket}>
                <div style={styles.ticketHead}>
                  <span style={styles.ticketId}>#{t.ticket_id}</span>
                  <span style={styles.ticketPriority}>{t.priority}</span>
                </div>
                <span style={styles.ticketSubject}>{t.subject}</span>
                <p style={styles.ticketBody}>{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  empty: {
    background: 'var(--bg-panel)',
    border: '1px dashed var(--border-strong)',
    borderRadius: 8,
    padding: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minHeight: 300,
    gap: 8,
  },
  emptyIcon: { fontSize: 22, color: 'var(--border-strong)', marginBottom: 4 },
  emptyLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 12,
    letterSpacing: '0.1em',
    color: 'var(--text-tertiary)',
  },
  emptySub: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    maxWidth: 280,
  },
  wrap: {
    display: 'flex',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sevBar: { width: 4, flexShrink: 0 },
  body: { padding: '24px 28px', flex: 1, minWidth: 0 },
  topRow: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  priorityTag: {
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '3px 8px',
    borderRadius: 3,
    border: '1px solid',
  },
  sevTag: {
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.08em',
    padding: '3px 8px',
    borderRadius: 3,
    border: '1px solid',
  },
  ownerTag: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-panel-raised)',
    padding: '3px 10px',
    borderRadius: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: '0 0 20px',
    color: 'var(--text-primary)',
    lineHeight: 1.25,
  },
  statRow: {
    display: 'flex',
    gap: 28,
    padding: '16px 0',
    borderTop: '1px solid var(--border-subtle)',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: 20,
  },
  statBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  statValue: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 },
  statLabel: { fontSize: 11, color: 'var(--text-tertiary)' },
  section: { marginBottom: 18 },
  sectionLabel: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: '0.1em',
    color: 'var(--accent-amber)',
    marginBottom: 6,
  },
  sectionText: { fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 },
  terms: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  term: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--border-subtle)',
    padding: '3px 8px',
    borderRadius: 3,
  },
  toggleBtn: {
    background: 'none',
    border: '1px solid var(--border-strong)',
    color: 'var(--accent-teal)',
    fontSize: 13,
    padding: '8px 14px',
    borderRadius: 5,
    marginTop: 4,
  },
  tickets: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  ticket: {
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    padding: 12,
  },
  ticketHead: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  ticketId: { fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-tertiary)' },
  ticketPriority: {
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
  },
  ticketSubject: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 },
  ticketBody: { fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 },
};
