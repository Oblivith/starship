import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * Reaction messages keyed by answer value (1–5), verbatim from the design doc.
 * reactionFor(v) returns a random variant — exported so the assessment page can
 * feed it straight into <ReactionToast>.
 */
export const REACTIONS = {
  1: ['Not your thing at all', 'Definitely not this path'],
  2: ['Not really for you', 'Probably not your forte'],
  3: ['Could go either way', 'Keeping options open'],
  4: ['This resonates with you', "You're drawn to this"],
  5: ['You really connect with this!', 'Strong match detected!'],
};

export function reactionFor(value) {
  const arr = REACTIONS[value];
  return arr ? arr[Math.floor(Math.random() * arr.length)] : '';
}

// position → diameter (px): outer two largest, middle smallest = strength of feeling.
const SIZES = [52, 46, 40, 46, 52];
// position → selected fill: red → (interp) → grey → (interp) → purple.
// Concrete hex (not CSS vars) so Framer Motion can interpolate the colour.
// These mirror --bubble-1…5 in tokens.css.
const FILLS = ['#E24B4A', '#B56965', '#888780', '#6E699C', '#534AB7'];

// position → hover/tap tooltip label, shown above the bubble. The end LABELS under
// the row stay "Not me" / "That's me"; these are per-bubble confirmations.
const TOOLTIPS = ['Not really me', 'A little like me', 'Sometimes', 'Quite like me', "That's me"];
// On touch, show the tooltip briefly before the tap registers as a selection.
const TOUCH_TIP_MS = 400;

/**
 * BubbleScale — the 5-bubble Dislike→Like RIASEC answer mechanic. Full
 * interaction: hover grow, tap fill + pulse ring, dim the unchosen, keyboard +
 * ARIA radiogroup. Works controlled (`value`) or uncontrolled (`defaultValue`).
 *
 * Props:
 *   value        {number|null}  controlled selection 1–5
 *   defaultValue {number|null}  uncontrolled initial (default null)
 *   onSelect     {(value:number, message:string) => void}
 *   leftLabel    {string}  (default 'Not me')
 *   rightLabel   {string}  (default "That's me")
 *   disabled     {boolean}
 *   className, style
 */
export default function BubbleScale({
  value,
  defaultValue = null,
  onSelect,
  leftLabel = 'Not me',
  rightLabel = "That's me",
  disabled = false,
  className = '',
  style = {},
}) {
  const reduceMotion = useReducedMotion();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = isControlled ? value : internal;
  const [pulseKey, setPulseKey] = useState(0); // bumps to re-fire the ring each tap

  const choose = (pos) => {
    if (disabled) return;
    const v = pos + 1;
    if (!isControlled) setInternal(v);
    setPulseKey((k) => k + 1);
    onSelect?.(v, reactionFor(v));
  };

  const onKeyDown = (e, pos) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(pos); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); choose(Math.min(4, pos + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); choose(Math.max(0, pos - 1)); }
  };

  // ---- hover / tap tooltips (TASK 5) ------------------------------------------
  // Selection logic is untouched: mouse/keyboard select immediately; touch shows
  // the tooltip for 400ms first, then registers the tap as the selection.
  const [tipPos, setTipPos] = useState(null);
  const touchingRef = useRef(false);
  const touchTimer = useRef(null);

  useEffect(() => () => clearTimeout(touchTimer.current), []);

  const showTip = (pos) => { if (!disabled) setTipPos(pos); };
  const hideTip = (pos) => setTipPos((p) => (p === pos ? null : p));

  // mouse hover — guarded against the emulated mouseenter a touch also fires.
  const handleMouseEnter = (pos) => { if (!touchingRef.current) showTip(pos); };
  const handleMouseLeave = (pos) => { if (!touchingRef.current) hideTip(pos); };

  // touch — show the tooltip first, register the selection after a 400ms beat.
  const handleTouchStart = (pos) => {
    if (disabled) return;
    touchingRef.current = true;
    setTipPos(pos);
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => {
      choose(pos);
      setTipPos((p) => (p === pos ? null : p));
      touchingRef.current = false;
    }, TOUCH_TIP_MS);
  };

  // click — mouse/keyboard path; ignore the synthetic click trailing a touch tap.
  const handleClick = (pos) => {
    if (touchingRef.current) return;
    choose(pos);
  };

  return (
    <div
      role="radiogroup"
      aria-label="How much is this like you?"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 4vw, 30px)' }}>
        {SIZES.map((d, pos) => {
          const isSel = selected === pos + 1;
          const fill = FILLS[pos];
          return (
            <div key={pos} style={{ position: 'relative', width: d, height: d }}>
              {/* pulse ring — re-mounts via pulseKey on every tap */}
              <AnimatePresence>
                {isSel && !reduceMotion && (
                  <motion.span
                    key={pulseKey}
                    initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: `2px solid ${fill}`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </AnimatePresence>

              {/* TASK 5 — hover/tap tooltip above the bubble, with a down arrow. */}
              <AnimatePresence>
                {tipPos === pos && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 4, x: '-50%' }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      whiteSpace: 'nowrap',
                      background: 'rgba(6,7,26,0.92)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(200,184,255,0.3)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 'var(--fs-body-sm)',
                      color: 'var(--text-primary)',
                      zIndex: 50,
                      pointerEvents: 'none',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
                    }}
                  >
                    {TOOLTIPS[pos]}
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid rgba(6,7,26,0.92)',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                role="radio"
                aria-checked={isSel}
                aria-label={`Rating ${pos + 1} of 5`}
                disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                onClick={() => handleClick(pos)}
                onKeyDown={(e) => onKeyDown(e, pos)}
                onMouseEnter={() => handleMouseEnter(pos)}
                onMouseLeave={() => handleMouseLeave(pos)}
                onTouchStart={() => handleTouchStart(pos)}
                whileHover={disabled ? undefined : { scale: 1.12 }}
                whileTap={disabled ? undefined : { scale: 0.92 }}
                animate={{
                  backgroundColor: isSel ? fill : 'rgba(255,255,255,0)',
                  borderColor: isSel ? fill : 'rgba(255,255,255,0.28)',
                  opacity: selected && !isSel ? 0.45 : 1,
                  boxShadow: isSel ? `0 0 18px ${fill}` : '0 0 0px rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  width: d,
                  height: d,
                  borderRadius: '50%',
                  borderStyle: 'solid',
                  borderWidth: 2,
                  background: 'transparent',
                  cursor: disabled ? 'default' : 'pointer',
                  padding: 0,
                  outlineOffset: 3,
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: 'min(420px, 86vw)' }}>
        <span className="starship-caption">{leftLabel}</span>
        <span className="starship-caption">{rightLabel}</span>
      </div>
    </div>
  );
}
