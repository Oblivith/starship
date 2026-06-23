import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * StatCounter — counts up from 0 to `value` the first time it scrolls into view
 * (IntersectionObserver via Framer's useInView). Numbers use Indian grouping
 * (en-IN). Reduced motion jumps straight to the final value.
 *
 * Props:
 *   value     {number}  target
 *   duration  {number}  ms (default 1600)
 *   prefix    {string}
 *   suffix    {string}  e.g. '+'
 *   decimals  {number}  (default 0)
 *   separator {boolean} thousands grouping (default true)
 *   label     {string}  caption beneath the number
 *   accent    {boolean} tint the number stardust vs plain white (default true)
 *   className, style
 */
export default function StatCounter({
  value = 0,
  duration = 1600,
  prefix = '',
  suffix = '',
  decimals = 0,
  separator = true,
  label,
  accent = true,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    let raf;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(value * easeOut(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduceMotion]);

  const n = Number(display.toFixed(decimals));
  const formatted = separator ? n.toLocaleString('en-IN') : String(n);

  return (
    <div ref={ref} className={className} style={{ textAlign: 'center', ...style }}>
      <div
        style={{
          fontSize: 'var(--fs-section)',
          fontWeight: 'var(--fw-medium)',
          lineHeight: 'var(--lh-tight)',
          color: accent ? 'var(--stardust)' : 'var(--text-primary)',
        }}
      >
        {prefix}{formatted}{suffix}
      </div>
      {label && <div className="starship-caption" style={{ marginTop: 8 }}>{label}</div>}
    </div>
  );
}
