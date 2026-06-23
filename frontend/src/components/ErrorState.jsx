/**
 * ErrorState — full-page error card with optional retry.
 * Props: { title, message, onRetry }
 */
export default function ErrorState({ title, message, onRetry }) {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 58px)',
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'var(--deep)',
          border: '1px solid rgba(91,82,184,0.40)',
          borderRadius: 'var(--radius-card)',
          padding: 'clamp(28px, 5vw, 40px)',
          textAlign: 'center',
          boxShadow: '0 0 32px rgba(91,82,184,0.12)',
        }}
      >
        {/* compass icon */}
        <div aria-hidden style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="17" stroke="var(--violet)" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="2.5" fill="var(--violet)" />
            {/* north needle */}
            <path d="M20 5 L22 18 L20 17 L18 18 Z" fill="var(--violet)" />
            {/* south needle (dimmed) */}
            <path d="M20 35 L18 22 L20 23 L22 22 Z" fill="var(--violet)" opacity="0.35" />
            {/* cardinal tick marks */}
            <line x1="20" y1="3" x2="20" y2="6.5" stroke="var(--violet)" strokeWidth="1.5" />
            <line x1="37" y1="20" x2="33.5" y2="20" stroke="var(--violet)" strokeWidth="1.5" opacity="0.45" />
            <line x1="20" y1="37" x2="20" y2="33.5" stroke="var(--violet)" strokeWidth="1.5" opacity="0.45" />
            <line x1="3" y1="20" x2="6.5" y2="20" stroke="var(--violet)" strokeWidth="1.5" opacity="0.45" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: 17,
            fontWeight: 'var(--fw-medium)',
            color: 'var(--text-primary)',
            margin: '0 0 10px',
            lineHeight: 1.4,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--moonstone)',
            margin: 0,
            lineHeight: 1.7,
          }}
        >
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 22,
              padding: '9px 22px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid var(--violet)',
              color: 'var(--stardust)',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--fw-medium)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
