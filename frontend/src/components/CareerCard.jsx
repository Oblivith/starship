import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { TIER_COLORS, standardTierOf } from '../utils/matchTiers.js';

/**
 * CareerCard — a ranked career match. Solid-tint title + match %, a bar that
 * fills from 0 when scrolled into view, and a hover lift with a soft violet glow
 * (never a heavy drop shadow). Stagger multiple cards with `index`.
 *
 * The match percentage NUMBER is tier-coloured (good → mint green, ok → gold amber,
 * other → coral) so its quality reads at a glance. The card background/border keep
 * the existing dark theme untouched. Pass `matchTier` to use a distribution-aware
 * (adaptive) tier — consistent with the Careers page filter — otherwise it falls
 * back to the standard absolute thresholds for the card's own percentage.
 *
 * Props:
 *   title             {string}
 *   field             {string}
 *   matchPercent      {number}    0–100
 *   matchTier         {'good'|'ok'|'other'}  optional; overrides the absolute-threshold tier
 *   percentileCaption {string}    optional, e.g. 'Top 8% of your matches' (shown under the %)
 *   icon              {ReactNode} optional leading glyph/emoji/SVG
 *   demand            {string}    optional, e.g. 'High demand'
 *   salaryRange       {string}    optional, e.g. '₹6–12 LPA'
 *   index             {number}    stagger order (default 0)
 *   onClick           {function}
 *   className, style
 */
export default function CareerCard({
  title,
  field,
  matchPercent = 0,
  matchTier,
  percentileCaption,
  icon,
  demand,
  salaryRange,
  index = 0,
  onClick,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const pct = Math.max(0, Math.min(100, matchPercent));
  const tier = matchTier || standardTierOf(pct);
  const pctColor = TIER_COLORS[tier] || 'var(--stardust)';

  // When the card navigates on click it must also be reachable by keyboard.
  // Mirrors the role/tabIndex/onKeyDown pattern in ScholarshipCard.jsx.
  const interactive = typeof onClick === 'function';

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
      whileHover={{ y: -4, boxShadow: '0 0 24px rgba(83,74,183,0.45)' }}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${title}${field ? `, ${field}` : ''} — ${Math.round(pct)}% match` : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      style={{
        background: 'var(--deep)',
        border: '1px solid rgba(200,184,255,0.10)',
        borderRadius: 'var(--radius-card)',
        padding: 22,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 0 0px rgba(83,74,183,0)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {icon != null && (
            <span
              style={{
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(83,74,183,0.18)',
                fontSize: 20,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--fs-body)',
                fontWeight: 'var(--fw-medium)',
                lineHeight: 1.25,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
            {field && <div className="starship-caption" style={{ marginTop: 4 }}>{field}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: '0 0 auto' }}>
          <div style={{ fontSize: 26, fontWeight: 'var(--fw-medium)', lineHeight: 1, color: pctColor }}>
            {Math.round(pct)}%
          </div>
          {percentileCaption && (
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--text-tertiary)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              {percentileCaption}
            </div>
          )}
        </div>
      </div>

      {/* match bar — fills from 0 on scroll entry */}
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : {}}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 + 0.15 }}
          style={{ height: '100%', background: 'var(--gradient-brand)' }}
        />
      </div>

      {(demand || salaryRange) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {demand && <span className="starship-caption" style={{ color: 'var(--glow)' }}>{demand}</span>}
          {salaryRange && <span className="starship-caption" style={{ color: 'var(--warm)' }}>{salaryRange}</span>}
        </div>
      )}
    </motion.div>
  );
}
