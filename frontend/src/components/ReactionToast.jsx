import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * ReactionToast — slides up from the bottom when `message` is set, then
 * auto-dismisses. Controlled by the parent: set `message` (e.g. from
 * BubbleScale's onSelect) and clear it in `onDismiss`.
 *
 * A persistent, full-width, centred, click-through wrapper holds the toast so
 * the inner element only animates y/opacity (keeping horizontal centring free
 * of Framer's transform).
 *
 * Props:
 *   message   {string|null}  line to show; null/'' hides it
 *   duration  {number}       ms before auto-dismiss (default 1800)
 *   accent    {string}       leading dot colour (default 'var(--glow)')
 *   onDismiss {() => void}
 *   bottom    {number}       px offset from viewport bottom (default 40)
 */
export default function ReactionToast({
  message,
  duration = 1800,
  accent = 'var(--glow)',
  onDismiss,
  bottom = 40,
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(id);
  }, [message, duration, onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 90,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {message ? (
          <motion.div
            key={message}
            role="status"
            aria-live="polite"
            initial={{ y: reduceMotion ? 0 : 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : 20, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 20px',
              background: 'var(--deep)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body-sm)',
              boxShadow: 'var(--glow-teal)',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
