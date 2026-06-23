import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StarfieldCanvas from '../../components/StarfieldCanvas.jsx';


/**
 * Shared chrome + form primitives for the auth pages (Login / Register /
 * VerifyOtp / Forgot / Reset). Dark cards, violet accents, font-weight ≤ 500,
 * no gradient text. API error messages render under the relevant field via the
 * <Field error> prop, or at the form level via <FormError>.
 */

// email-or-phone → the payload shape the backend expects.
export function toIdentifier(raw) {
  const v = (raw || '').trim();
  if (!v) return {};
  return v.includes('@') ? { email: v } : { phone_number: v };
}

// Pull a human-readable message out of an axios error ({error: "..."} bodies).
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export function AuthScreen({ title, subtitle, children, footer }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <StarfieldCanvas glowColor="rgba(83,74,183,0.14)" />
      {/* Faint violet radial gradient adds atmospheric depth above the starfield */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(83,74,183,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 'clamp(20px, 5vw, 48px) 20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ width: 'min(420px, 100%)' }}
        >
          {/* wordmark — consistent sizing per design rules */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              marginBottom: 26,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M9 0.5 L11 6.6 L17.5 9 L11 11.4 L9 17.5 L7 11.4 L0.5 9 L7 6.6 Z"
                fill="var(--stardust)"
              />
            </svg>
            <span
              style={{
                color: 'var(--stardust)',
                fontWeight: 'var(--fw-medium)',
                letterSpacing: '0.12em',
                fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
                textTransform: 'uppercase',
              }}
            >
              Starship
            </span>
          </Link>

          <div
            style={{
              background: 'var(--deep)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(22px, 4vw, 32px)',
              boxShadow: '0 0 40px rgba(83,74,183,0.15)',
            }}
          >
            <h1
              style={{
                fontSize: 24,
                fontWeight: 'var(--fw-medium)',
                lineHeight: 'var(--lh-tight)',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ color: 'var(--text-secondary)', margin: '10px 0 0', fontSize: 'var(--fs-body-sm)', lineHeight: 1.6 }}>
                {subtitle}
              </p>
            )}

            <div style={{ marginTop: 24 }}>{children}</div>
          </div>

          {footer && (
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)' }}>
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--fs-caption)',
  fontWeight: 'var(--fw-medium)',
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 8,
};

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  name,
  autoComplete,
  inputMode,
  hint,
  autoFocus,
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label htmlFor={name} style={labelStyle}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%',
          background: 'var(--void)',
          border: `1px solid ${
            error ? 'rgba(216,90,48,0.7)' : focus ? 'var(--violet)' : 'rgba(255,255,255,0.12)'
          }`,
          borderRadius: 12,
          padding: '12px 14px',
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-body)',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          transition: 'border-color 160ms var(--ease-emphasis)',
        }}
      />
      {hint && !error && (
        <p id={`${name}-hint`} style={{ margin: '7px 2px 0', fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>{hint}</p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" style={{ margin: '7px 2px 0', fontSize: 'var(--fs-caption)', color: 'var(--coral)' }}>{error}</p>
      )}
    </div>
  );
}

export function Select({ label, value, onChange, options, placeholder, name, error }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label htmlFor={name} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--void)',
          border: `1px solid ${error ? 'rgba(216,90,48,0.7)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 12,
          padding: '12px 14px',
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 'var(--fs-body)',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          appearance: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: 'var(--deep)', color: 'var(--text-primary)' }}>
            {opt}
          </option>
        ))}
      </select>
      {error && (
        <p style={{ margin: '7px 2px 0', fontSize: 'var(--fs-caption)', color: 'var(--coral)' }}>{error}</p>
      )}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginBottom: 18,
        padding: '11px 14px',
        borderRadius: 12,
        background: 'rgba(216,90,48,0.10)',
        border: '1px solid rgba(216,90,48,0.35)',
        color: 'var(--coral)',
        fontSize: 'var(--fs-body-sm)',
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function Notice({ message, tone = 'info' }) {
  if (!message) return null;
  const tones = {
    info: { bg: 'rgba(77,217,184,0.08)', border: 'rgba(77,217,184,0.30)', color: 'var(--glow)' },
    warn: { bg: 'rgba(239,159,39,0.10)', border: 'rgba(239,159,39,0.35)', color: 'var(--warm)' },
  };
  const t = tones[tone] || tones.info;
  return (
    <div
      style={{
        marginBottom: 18,
        padding: '11px 14px',
        borderRadius: 12,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: 'var(--fs-body-sm)',
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function SubmitButton({ children, loading, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        marginTop: 4,
        padding: '10px 20px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: 'var(--gradient-brand)',
        color: 'var(--text-primary)',
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-medium)',
        fontFamily: 'var(--font-sans)',
        cursor: loading || disabled ? 'default' : 'pointer',
        opacity: loading || disabled ? 0.6 : hover ? 0.88 : 1,
        transition: 'opacity 160ms var(--ease-emphasis)',
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

// A plain text link styled for the auth footers / inline actions.
export function authLink(extra = {}) {
  return {
    color: 'var(--stardust)',
    textDecoration: 'none',
    fontWeight: 'var(--fw-medium)',
    ...extra,
  };
}
