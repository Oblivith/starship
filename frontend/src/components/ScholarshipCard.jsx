import { useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

/**
 * ScholarshipCard — gold-scheme funding card.
 *
 * Props:
 *   name             {string}
 *   amount           {string|number}
 *   period           {string}          default '/ year'
 *   provider         {string}          optional — provider from card-level display
 *   deadline         {string}          optional
 *   eligibility      {string[]}        tag list (competitiveness chips)
 *   applyUrl         {string}          href for Apply button
 *   onApply          {function}
 *   index            {number}
 *   // detail panel fields (from expanded backend payload)
 *   description      {string}          optional
 *   eligibilityText  {string}          optional — raw eligibility_criteria text
 *   providerName     {string}          optional — provider_name
 *   streamTags       {string[]}        optional
 *   deadlineMonth    {string}          optional
 *   // expand control (managed by parent for "only one open at a time")
 *   expanded         {boolean}
 *   onToggle         {function}
 *   className, style
 */
export default function ScholarshipCard({
  name,
  amount,
  period = '/ year',
  provider,
  deadline,
  eligibility = [],
  applyUrl,
  onApply,
  index = 0,
  description,
  eligibilityText,
  providerName,
  streamTags = [],
  deadlineMonth,
  expanded = false,
  onToggle,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const amountText =
    typeof amount === 'number' ? `₹${amount.toLocaleString('en-IN')} ${period}` : amount;

  const displayProvider = providerName || provider;

  // Close on Esc when expanded
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => { if (e.key === 'Escape') onToggle?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded, onToggle]);

  return (
    <div ref={ref} className={className} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {/* Main card — clickable */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
        whileHover={!expanded ? { y: -4, boxShadow: '0 0 26px rgba(239,159,39,0.30)' } : {}}
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); } }}
        style={{
          position: 'relative',
          background: 'var(--deep)',
          border: expanded ? '1px solid rgba(239,159,39,0.55)' : '1px solid rgba(239,159,39,0.28)',
          borderRadius: expanded ? 'var(--radius-card) var(--radius-card) 0 0' : 'var(--radius-card)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflow: 'hidden',
          cursor: 'pointer',
          boxShadow: expanded ? '0 0 18px rgba(239,159,39,0.14)' : '0 0 0px rgba(239,159,39,0)',
          transition: 'border-color 0.2s, border-radius 0.2s, box-shadow 0.2s',
        }}
      >
        {/* gold edge accent */}
        <span
          aria-hidden
          style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'var(--gradient-gold)' }}
        />

        <div>
          {displayProvider && (
            <div className="starship-caption" style={{ color: 'var(--warm)' }}>{displayProvider}</div>
          )}
          <div style={{ fontSize: 17, fontWeight: 'var(--fw-medium)', marginTop: displayProvider ? 4 : 0 }}>{name}</div>
        </div>

        <div style={{ fontSize: 28, fontWeight: 'var(--fw-medium)', color: 'var(--warm)', lineHeight: 1 }}>
          {amountText}
        </div>

        {eligibility.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {eligibility.map((tag, i) => (
              <span
                key={i}
                className="starship-caption"
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(239,159,39,0.12)',
                  color: 'var(--warm)',
                  letterSpacing: '0.08em',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
          {deadline ? (
            <span className="starship-caption" style={{ color: 'var(--text-secondary)' }}>Apply by {deadline}</span>
          ) : (
            <span />
          )}
          {/* Chevron toggle indicator */}
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              marginLeft: 'auto',
            }}
          >
            ▾
          </span>
        </div>
      </motion.div>

      {/* Inline detail panel — below the card, in normal document flow */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                background: 'var(--deep)',
                border: '1px solid var(--violet)',
                borderTop: 'none',
                borderRadius: '0 0 var(--radius-card) var(--radius-card)',
                padding: '18px 22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {description && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--fs-body-sm)',
                    fontWeight: 'var(--fw-regular)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                  }}
                >
                  {description}
                </p>
              )}

              {eligibilityText && (
                <div>
                  <div className="starship-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    Eligibility
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--fs-body-sm)',
                      fontWeight: 'var(--fw-regular)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.65,
                    }}
                  >
                    {eligibilityText}
                  </p>
                </div>
              )}

              {providerName && (
                <div>
                  <div className="starship-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    Provider
                  </div>
                  <div style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>
                    {providerName}
                  </div>
                </div>
              )}

              {streamTags.length > 0 && (
                <div>
                  <div className="starship-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Streams
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {streamTags.map((tag, i) => (
                      <span
                        key={i}
                        className="starship-caption"
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'rgba(93,82,184,0.14)',
                          border: '1px solid rgba(200,184,255,0.15)',
                          color: 'var(--stardust)',
                          letterSpacing: '0.07em',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
                {deadlineMonth ? (
                  <span className="starship-caption" style={{ color: 'var(--text-secondary)' }}>
                    Deadline: {deadlineMonth}
                  </span>
                ) : <span />}

                {applyUrl && (
                  <motion.a
                    href={applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { e.stopPropagation(); onApply?.(); }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 16px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--gradient-gold)',
                      color: 'var(--void)',
                      fontSize: 'var(--fs-body-sm)',
                      fontWeight: 'var(--fw-medium)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Apply →
                  </motion.a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
