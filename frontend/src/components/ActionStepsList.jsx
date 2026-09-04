import React from 'react';
import { parseActionSteps } from '../utils/actionSteps';

export default function ActionStepsList({ text, compact = false }) {
  const steps = parseActionSteps(text);
  if (steps.length === 0) return null;

  return (
    <ul style={{ ...styles.list, ...(compact ? styles.listCompact : {}) }}>
      {steps.map((step, i) => (
        <li key={i} style={{ ...styles.item, ...(compact ? styles.itemCompact : {}) }}>
          <span style={styles.icon}>→</span>
          <span>{step}</span>
        </li>
      ))}
    </ul>
  );
}

const styles = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listCompact: { gap: 6 },
  item: {
    display: 'flex',
    gap: 8,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    alignItems: 'flex-start',
  },
  itemCompact: { fontSize: 13 },
  icon: {
    color: 'var(--accent-teal)',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
  },
};
