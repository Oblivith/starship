import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * UniversityCard — a matched university/college. Violet scheme (distinct from
 * the gold ScholarshipCard). Name + location, an optional NIRF-style rank pill,
 * annual cost called out, programme tags, and a View button — with a hover lift
 * and a soft violet glow (never a heavy drop shadow). Stagger with `index`.
 *
 * Props:
 *   name        {string}
 *   location    {string}          e.g. 'Jaipur, Rajasthan'
 *   type        {string}          e.g. 'Government' | 'Private'
 *   annualCost  {string|number}   number → '₹X / year'; null/undefined → 'Cost on request'
 *   period      {string}          used when annualCost is numeric (default '/ year')
 *   ranking     {string|number}   optional; number → 'NIRF #N'
 *   matchPercent{number}          optional 0–100
 *   programs    {string[]}        tag list
 *   onView      {function}        View click handler
 *   viewUrl     {string}          href (opens new tab) — alternative to onView
 *   index       {number}          stagger order (default 0)
 *   className, style
 */
export default function UniversityCard({
  name,
  location,
  type,
  annualCost,
  period = '/ year',
  ranking,
  matchPercent,
  programs = [],
  onView,
  viewUrl,
  index = 0,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const costText =
    annualCost == null
      ? 'Cost on request'
      : typeof annualCost === 'number'
        ? `₹${annualCost.toLocaleString('en-IN')} ${period}`
        : annualCost;

  const rankText = ranking == null ? null : typeof ranking === 'number' ? `NIRF #${ranking}` : ranking;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
      whileHover={{ y: -4, boxShadow: '0 0 24px rgba(91,82,184,0.40)' }}
      style={{
        background: 'var(--deep)',
        border: '1px solid rgba(200,184,255,0.10)',
        borderRadius: 'var(--radius-card)',
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 0 0px rgba(91,82,184,0)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {name}
          </div>
          {(location || type) && (
            <div className="starship-caption" style={{ marginTop: 5, letterSpacing: '0.06em' }}>
              {[location, type].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {rankText && (
          <span
            className="starship-caption"
            style={{
              flex: '0 0 auto',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(91,82,184,0.18)',
              color: 'var(--stardust)',
              letterSpacing: '0.06em',
            }}
          >
            {rankText}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {costText}
        </span>
        {typeof matchPercent === 'number' && (
          <span className="starship-caption" style={{ color: 'var(--glow)' }}>
            {Math.round(matchPercent)}% match
          </span>
        )}
      </div>

      {programs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {programs.map((p, i) => (
            <span
              key={i}
              className="starship-caption"
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(200,184,255,0.08)',
                color: 'var(--stardust)',
                letterSpacing: '0.06em',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {(onView || viewUrl) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <motion.a
            href={viewUrl || undefined}
            target={viewUrl ? '_blank' : undefined}
            rel={viewUrl ? 'noreferrer' : undefined}
            onClick={onView}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--gradient-brand)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body-sm)',
              fontWeight: 'var(--fw-medium)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            View →
          </motion.a>
        </div>
      )}
    </motion.div>
  );
}
