import { motion } from 'framer-motion';

/**
 * ProgressBar — thin gradient progress indicator.
 * Default is a 3px bar fixed to the very top of the viewport (assessment style);
 * pass fixed={false} to render it inline inside a container.
 *
 * Props:
 *   value      {number}  explicit percent 0–100 (wins over current/total)
 *   current    {number}  e.g. current question number
 *   total      {number}  e.g. total questions
 *   height     {number}  px (default 3)
 *   fixed      {boolean} pin to top of viewport (default true)
 *   gradient   {string}  fill (default 'var(--gradient-brand)')
 *   trackColor {string}  (default 'rgba(255,255,255,0.06)')
 *   glow       {boolean} violet glow under the fill (default true)
 *   className, style
 */
export default function ProgressBar({
  value,
  current,
  total,
  height = 3,
  fixed = true,
  gradient = 'var(--gradient-brand)',
  trackColor = 'rgba(255,255,255,0.06)',
  glow = true,
  className = '',
  style = {},
}) {
  let pct = value;
  if (pct == null && total) pct = (current / total) * 100;
  pct = Math.max(0, Math.min(100, pct || 0));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={className}
      style={{
        position: fixed ? 'fixed' : 'relative',
        top: fixed ? 0 : undefined,
        left: fixed ? 0 : undefined,
        width: '100%',
        height,
        backgroundColor: trackColor,
        overflow: 'hidden',
        zIndex: fixed ? 100 : undefined,
        ...style,
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        style={{
          height: '100%',
          background: gradient,
          boxShadow: glow ? 'var(--glow-violet)' : 'none',
        }}
      />
    </div>
  );
}
