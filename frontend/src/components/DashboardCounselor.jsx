import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import client from '../api/client.js';
import AIOrb from './AIOrb.jsx';

/**
 * DashboardCounselor — the Dashboard's prominent counselor entry point (TASK 4).
 *
 * Renders two things:
 *   1. An inline CARD (a flex item in the Dashboard's top row — top-right on
 *      desktop, wraps below the welcome header on mobile) with a heading,
 *      subtext, and a text input + send button. Its border carries a slow 3s
 *      --violet glow pulse.
 *   2. The full floating <AIOrb> panel, driven in CONTROLLED mode so the card's
 *      send opens it with the typed message pre-populated in the panel input.
 *
 * Chat itself is wired to POST /chat exactly like the shared CounselorOrb — the
 * backend owns conversation context (cached results + last-10 memory per session).
 */

function friendlyError(err) {
  const raw = (err?.response?.data?.error || err?.message || '').toLowerCase();
  if (/rate|limit|429|quota|trial|too many/.test(raw)) {
    return 'I’m getting a lot of questions right now and need a short breather. Please try again in a minute.';
  }
  return 'I couldn’t reach the counselor just now. Please check your connection and try again.';
}

export default function DashboardCounselor() {
  const reduceMotion = useReducedMotion();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(''); // controlled draft for the AIOrb panel
  const [cardText, setCardText] = useState(''); // the card's own input

  const onSend = async (text) => {
    if (loading) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const { data } = await client.post('/chat', { message: text });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: friendlyError(err) }]);
    } finally {
      setLoading(false);
    }
  };

  // Card send → open the full AIOrb panel with the typed message pre-populated in
  // its input (the student confirms / sends from the panel).
  const onCardSubmit = (e) => {
    e.preventDefault();
    setDraft(cardText.trim()); // pre-populate the panel (empty is fine — just opens it)
    setOpen(true);
    setCardText('');
  };

  return (
    <>
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  '0 0 0px rgba(91,82,184,0.0)',
                  '0 0 26px rgba(91,82,184,0.5)',
                  '0 0 0px rgba(91,82,184,0.0)',
                ],
              }
        }
        transition={reduceMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          flex: '1 1 320px',
          minWidth: 0,
          maxWidth: 400,
          background: 'var(--deep)',
          border: '1px solid var(--violet)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span
            style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--glow)', boxShadow: '0 0 10px var(--glow)' }}
          />
          <h2 style={{ margin: 0, fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>
            Your AI Counselor
          </h2>
        </div>
        <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 'var(--fs-body-sm)', lineHeight: 1.6 }}>
          Ask me anything about your results.
        </p>
        <form onSubmit={onCardSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            value={cardText}
            onChange={(e) => setCardText(e.target.value)}
            placeholder="e.g. Why is this my top match?"
            aria-label="Ask the AI counselor"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--void)',
              border: '1px solid rgba(200,184,255,0.18)',
              borderRadius: 'var(--radius-pill)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            aria-label="Ask counselor"
            style={{
              flex: '0 0 auto',
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              background: 'var(--violet)',
              fontSize: 16,
            }}
          >
            →
          </button>
        </form>
      </motion.div>

      {/* The full floating counselor — controlled, so the card opens it pre-filled. */}
      <AIOrb
        messages={messages}
        onSend={onSend}
        isLoading={loading}
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        onDraftChange={setDraft}
      />
    </>
  );
}
