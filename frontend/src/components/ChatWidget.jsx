import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the support assistant. What can I help you with today?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) {
      // small delay so it focuses after the open animation starts, not before
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const history = newMessages
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage(history, text);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting right now - the support assistant may be offline. Please try again in a moment.", isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {open && (
        <div className="scale-in" style={styles.panel}>
          <div style={styles.header}>
            <div>
              <span style={styles.headerTitle}>Support</span>
              <span className="pulse" style={styles.headerDot}>●</span>
              <span style={styles.headerStatus}>online</span>
            </div>
            <button style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div style={styles.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className="fade-in"
                style={{
                  ...styles.bubbleRow,
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    ...styles.bubble,
                    ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant),
                    ...(m.isError ? styles.bubbleError : {}),
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="fade-in" style={{ ...styles.bubbleRow, justifyContent: 'flex-start' }}>
                <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
                  <span className="typing-dots"><span /><span /><span /></span>
                </div>
              </div>
            )}
          </div>
          <div style={styles.inputRow}>
            <input
              ref={inputRef}
              style={styles.input}
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }} onClick={handleSend} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
      <button style={styles.fab} onClick={() => setOpen((o) => !o)} aria-label="Toggle support chat">
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}

const styles = {
  root: { position: 'fixed', bottom: 24, right: 24, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  fab: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    background: 'var(--accent-amber)',
    border: 'none',
    fontSize: 22,
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
    marginTop: 12,
  },
  panel: {
    width: 340,
    height: 460,
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-strong)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    transformOrigin: 'bottom right',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-panel-raised)',
  },
  headerTitle: { fontSize: 14, fontWeight: 600, marginRight: 8 },
  headerDot: { color: 'var(--accent-teal)', fontSize: 10, marginRight: 4 },
  headerStatus: { fontSize: 11, color: 'var(--text-tertiary)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 14 },
  messages: { flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 },
  bubbleRow: { display: 'flex' },
  bubble: {
    maxWidth: '80%',
    padding: '9px 12px',
    borderRadius: 12,
    fontSize: 13.5,
    lineHeight: 1.45,
  },
  bubbleUser: {
    background: 'var(--accent-teal-dim)',
    color: 'var(--text-primary)',
    borderBottomRightRadius: 3,
  },
  bubbleAssistant: {
    background: 'var(--bg-panel-raised)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderBottomLeftRadius: 3,
  },
  bubbleError: {
    background: 'rgba(229,72,77,0.08)',
    border: '1px solid var(--sev-critical)',
    color: 'var(--text-primary)',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid var(--border-subtle)',
  },
  input: {
    flex: 1,
    background: 'var(--bg-panel-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '9px 12px',
    color: 'var(--text-primary)',
    fontSize: 13,
  },
  sendBtn: {
    background: 'var(--accent-amber)',
    border: 'none',
    borderRadius: 8,
    padding: '0 16px',
    fontWeight: 600,
    fontSize: 13,
    color: '#1A1206',
  },
};
