import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import StarfieldCanvas from '../components/StarfieldCanvas.jsx';
import ConfirmLeaveModal from '../components/ConfirmLeaveModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NavGuardProvider, useNavGuard } from '../context/NavGuardContext.jsx';
import { useSoundManager } from '../components/SoundManager.jsx';

/**
 * AppShell — persistent chrome for the authenticated product funnel.
 *
 *   - STARSHIP wordmark (left) links back into the app.
 *   - Student name + logout (right). Logout clears the session and routes to /login.
 *   - A dimmed StarfieldCanvas (opacity ~0.4) sits behind everything so space
 *     stays the backdrop and the student-facing content is the subject.
 *
 * BUG 2 — progress protection: the shell is wrapped in a <NavGuardProvider>. When
 * the assessment page has flagged unsaved progress, the wordmark / profile /
 * logout controls route their action through a styled confirmation modal before
 * leaving, instead of navigating away and silently dropping answers.
 *
 * Page content renders through <Outlet />.
 */
export default function AppShell() {
  return (
    <NavGuardProvider>
      <AppShellInner />
    </NavGuardProvider>
  );
}

function AppShellInner() {
  const { student, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { requestLeave, isPrompting, confirmLeave, cancelLeave } = useNavGuard();
  const { playHover, playClick, toggleSound, soundEnabled } = useSoundManager();

  const displayName =
    student?.name?.trim() || student?.email || student?.phone_number || 'Your profile';

  // Route any "leave the funnel" action through the nav guard. With no unsaved
  // progress it runs immediately; mid-assessment it raises the confirm modal.
  // playClick() gives every nav control the same tactile sound sitewide.
  const guardedNavigate = (to) => { playClick(); requestLeave(() => navigate(to)); };

  const handleLogout = () => {
    playClick();
    requestLeave(async () => {
      if (busy) return;
      setBusy(true);
      await logout();
      navigate('/login');
    });
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* dimmed starfield backdrop */}
      <div
        aria-hidden
        style={{ position: 'fixed', inset: 0, opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}
      >
        <StarfieldCanvas glowColor="rgba(83,74,183,0.10)" />
      </div>

      {/* top nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px clamp(16px, 4vw, 40px)',
          background: 'rgba(4,6,26,0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link
          to="/onboarding"
          onMouseEnter={playHover}
          onClick={(e) => {
            e.preventDefault();
            guardedNavigate('/onboarding');
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M9 0.5 L11 6.6 L17.5 9 L11 11.4 L9 17.5 L7 11.4 L0.5 9 L7 6.6 Z"
              fill="var(--stardust)"
            />
          </svg>
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 'var(--fw-medium)',
              letterSpacing: '0.18em',
              fontSize: 13,
              textTransform: 'uppercase',
            }}
          >
            Starship
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link
            to="/profile"
            title="View profile"
            onMouseEnter={playHover}
            onClick={(e) => {
              e.preventDefault();
              guardedNavigate('/profile');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              textDecoration: 'none',
              color: 'var(--text-primary)',
              maxWidth: '46vw',
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: '0 0 auto',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(91,82,184,0.22)',
                color: 'var(--stardust)',
                fontSize: 13,
                fontWeight: 'var(--fw-medium)',
              }}
            >
              {(displayName[0] || 'S').toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 'var(--fs-body-sm)',
                fontWeight: 'var(--fw-regular)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </span>
          </Link>

          {/* Sound toggle — inline SVG speaker icon, no label, no border/bg */}
          <button
            type="button"
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            onClick={toggleSound}
            style={{
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              width: 32,
              height: 32,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: 'var(--stardust)',
              opacity: 0.55,
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; playHover(); }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" opacity="0.85" />
              {soundEnabled ? (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              ) : (
                <line x1="23" y1="1" x2="1" y2="23" />
              )}
            </svg>
          </button>

          <button
            onClick={handleLogout}
            disabled={busy}
            className="starship-caption"
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.opacity = '0.78'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = busy ? '0.5' : '1'; }}
            style={{
              flex: '0 0 auto',
              padding: 'var(--btn-py-sm) var(--btn-px-sm)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid rgba(200,184,255,0.28)',
              color: 'var(--text-secondary)',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.5 : 1,
              transition: 'opacity 160ms var(--ease-emphasis)',
            }}
          >
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </header>

      {/* page content */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1 }}>
        <Outlet />
      </main>

      {/* BUG 2 — confirm before leaving an in-progress assessment */}
      <AnimatePresence>
        {isPrompting && <ConfirmLeaveModal onLeave={confirmLeave} onStay={cancelLeave} />}
      </AnimatePresence>
    </div>
  );
}
