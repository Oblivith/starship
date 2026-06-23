import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * ConfirmLeaveModal — on-brand confirmation shown when a student tries to leave
 * an in-progress assessment (BUG 2). Dark card, violet accents; deliberately not
 * a browser alert(). Render it inside an <AnimatePresence> so the exit animation
 * plays:
 *
 *   <AnimatePresence>{isPrompting && <ConfirmLeaveModal … />}</AnimatePresence>
 *
 * Props:
 *   onLeave  {() => void}  confirm — discard progress and navigate away
 *   onStay   {() => void}  cancel — keep the assessment (backdrop click / Esc too)
 */
export default function ConfirmLeaveModal({ onLeave, onStay }) {
  const reduceMotion = useReducedMotion();

  // Esc keeps you safely in the assessment.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onStay?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <motion.div
      role="presentation"
      onClick={onStay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(4,6,26,0.66)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        aria-describedby="leave-desc"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--deep)',
          border: '1px solid rgba(91,82,184,0.45)',
          borderRadius: 'var(--radius-card)',
          padding: 'clamp(24px, 4vw, 32px)',
          boxShadow: '0 0 40px rgba(91,82,184,0.25)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(91,82,184,0.22)',
            color: 'var(--stardust)',
            marginBottom: 18,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h2
          id="leave-title"
          style={{
            fontSize: 'var(--fs-section)',
            fontWeight: 'var(--fw-medium)',
            lineHeight: 1.3,
            margin: '0 0 10px',
            color: 'var(--text-primary)',
          }}
        >
          Leave the assessment?
        </h2>
        <p id="leave-desc" style={{ color: 'var(--text-secondary)', margin: '0 0 26px', lineHeight: 1.7 }}>
          Your progress may not be saved. Are you sure you want to leave?
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onLeave}
            className="starship-caption"
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              border: '1px solid rgba(200,184,255,0.28)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Leave anyway
          </button>
          <button
            type="button"
            onClick={onStay}
            autoFocus
            style={{
              padding: '11px 20px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--violet)',
              border: '1px solid var(--violet)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--fw-medium)',
              fontSize: 'var(--fs-body-sm)',
            }}
          >
            Keep going
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
