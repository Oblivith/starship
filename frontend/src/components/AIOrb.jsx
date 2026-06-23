import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const DEFAULT_PROMPTS = [
  'Why is this career right for me?',
  'What exams do I need?',
  'Show me affordable universities in my state',
  'Which scholarships can I apply for?',
];

/**
 * AIOrb — floating teal counselor orb pinned bottom-right. Continuous pulse
 * glow; click springs it open into a dark chat panel; click again (or ×) closes.
 *
 * Presentational: pass `messages` and an `onSend(text)` handler and wire it to
 * the /chat endpoint (via api/client.js) in a later session. Open/closed and
 * the input draft are managed internally.
 *
 * Props:
 *   messages         {{role:'user'|'assistant', content:string}[]}
 *   onSend           {(text:string) => void}
 *   isLoading        {boolean}
 *   suggestedPrompts {string[]}  (defaults from the design doc)
 *   title            {string}    panel header (default 'STARSHIP Counselor')
 *   defaultOpen      {boolean}
 *   open             {boolean}   optional CONTROLLED open state (else internal)
 *   onOpenChange     {(open:boolean) => void}
 *   draft            {string}    optional CONTROLLED input draft (else internal)
 *   onDraftChange    {(text:string) => void}
 */
export default function AIOrb({
  messages = [],
  onSend,
  isLoading = false,
  suggestedPrompts = DEFAULT_PROMPTS,
  title = 'STARSHIP Counselor',
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  draft: draftProp,
  onDraftChange,
}) {
  const reduceMotion = useReducedMotion();

  // Controlled/uncontrolled open + draft. With no open/draft props this behaves
  // exactly as before (internal state) — so CounselorOrb and every existing
  // floating-orb usage is unchanged. The Dashboard counselor card passes both so
  // it can open the panel with a pre-populated message.
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : openInternal;
  const setOpen = (next) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (!isOpenControlled) setOpenInternal(value);
    onOpenChange?.(value);
  };

  const [draftInternal, setDraftInternal] = useState('');
  const isDraftControlled = draftProp !== undefined;
  const draft = isDraftControlled ? draftProp : draftInternal;
  const setDraft = (next) => {
    const value = typeof next === 'function' ? next(draft) : next;
    if (!isDraftControlled) setDraftInternal(value);
    onDraftChange?.(value);
  };

  const scrollRef = useRef(null);

  // --- Simulated typing -----------------------------------------------------
  // Cohere replies arrive as one complete string (the /chat call is a normal
  // JSON request through the axios client, which keeps the JWT refresh + error
  // handling intact). To get the progressive "typing in" feel of a standard
  // chatbot, the most recently arrived ASSISTANT message is revealed gradually
  // here, ~4 chars every 18ms, instead of appearing all at once. Earlier
  // messages always render in full.
  const [revealCount, setRevealCount] = useState(0);
  const typingIdxRef = useRef(-1);

  useEffect(() => {
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];

    // Only the freshly-arrived assistant message at the end gets animated.
    if (!last || last.role !== 'assistant') {
      typingIdxRef.current = -1;
      return;
    }
    if (typingIdxRef.current === lastIdx) return; // already typed / typing this one
    typingIdxRef.current = lastIdx;

    if (reduceMotion) {
      setRevealCount(last.content.length);
      return;
    }

    setRevealCount(0);
    let n = 0;
    const id = setInterval(() => {
      n = Math.min(last.content.length, n + 4);
      setRevealCount(n);
      if (n >= last.content.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [messages, reduceMotion]);

  // keep the transcript pinned to the latest message (also as it types in)
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, isLoading, revealCount]);

  const send = (text) => {
    // Don't send (or clear the draft) while a reply is in flight — the consumer
    // ignores sends during loading, so clearing here would lose the typed message.
    if (isLoading) return;
    const t = (text ?? draft).trim();
    if (!t) return;
    onSend?.(t);
    setDraft('');
  };

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 80 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 76,
              transformOrigin: 'bottom right',
              width: 'min(380px, calc(100vw - 32px))',
              height: 'min(560px, calc(100vh - 140px))',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--deep)',
              border: '1px solid rgba(77,223,189,0.22)',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 0 30px rgba(77,223,189,0.18)',
            }}
          >
            {/* header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--glow)', boxShadow: '0 0 10px var(--glow)' }} />
                <span style={{ fontWeight: 'var(--fw-medium)' }}>{title}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close counselor"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>

            {/* transcript */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>
                  Ask me anything about your results, exams, universities or scholarships.
                </p>
              )}
              {messages.map((m, i) => {
                const mine = m.role === 'user';
                // The last assistant message types in progressively; everything
                // else is shown in full.
                const isTyping = !mine && i === messages.length - 1 && i === typingIdxRef.current;
                const content = isTyping ? m.content.slice(0, revealCount) : m.content;
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 14,
                      borderBottomRightRadius: mine ? 4 : 14,
                      borderBottomLeftRadius: mine ? 14 : 4,
                      fontSize: 'var(--fs-body-sm)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      background: mine ? 'var(--violet)' : 'rgba(77,223,189,0.10)',
                      color: mine ? '#fff' : 'var(--glow)',
                      border: mine ? 'none' : '1px solid rgba(77,223,189,0.20)',
                    }}
                  >
                    {content}
                  </div>
                );
              })}
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '10px 14px' }}>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={reduceMotion ? {} : { opacity: [0.3, 1, 0.3] }}
                      transition={reduceMotion ? {} : { repeat: Infinity, duration: 1, delay: i * 0.18 }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--glow)' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* suggested prompts — only before the conversation starts */}
            {messages.length === 0 && suggestedPrompts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 12px' }}>
                {suggestedPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'rgba(77,223,189,0.08)',
                      color: 'var(--glow)',
                      border: '1px solid rgba(77,223,189,0.22)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your question…"
                style={{
                  flex: 1,
                  background: 'var(--void)',
                  border: '1px solid rgba(255,255,255,0.10)',
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
                aria-label="Send"
                disabled={isLoading}
                style={{
                  flex: '0 0 auto',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: isLoading ? 'default' : 'pointer',
                  color: 'var(--void)',
                  background: 'var(--gradient-teal)',
                  fontSize: 16,
                  opacity: isLoading ? 0.5 : 1,
                  transition: 'opacity 160ms var(--ease-emphasis)',
                }}
              >
                →
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the orb */}
      <motion.button
        aria-label={open ? 'Close counselor' : 'Open AI counselor'}
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        style={{
          position: 'relative',
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle at 30% 30%, var(--glow), var(--aurora))',
          color: 'var(--void)',
        }}
      >
        {/* expanding pulse ring */}
        {!reduceMotion && (
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--glow)' }}
          />
        )}
        {/* static glow halo */}
        <span aria-hidden style={{ position: 'absolute', inset: -4, borderRadius: '50%', boxShadow: '0 0 22px rgba(77,223,189,0.55)', pointerEvents: 'none' }} />
        {/* orbit glyph */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" fill="var(--void)" />
          <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--void)" strokeOpacity="0.85" strokeWidth="1.5" transform="rotate(-25 12 12)" fill="none" />
        </svg>
      </motion.button>
    </div>
  );
}
