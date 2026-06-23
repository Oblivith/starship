import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { setTokens } from '../api/client.js';

/**
 * GoogleAuthSuccess — landing page for the Google OAuth redirect.
 *
 * The backend redirects here after a successful OAuth exchange:
 *   /auth/google/success?token=<access>&refresh=<refresh>
 *
 * We store the tokens, rehydrate the profile via login(), then send the
 * student to /dashboard (completed) or /onboarding (first time).
 */
export default function GoogleAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Store tokens synchronously so the shared client attaches them on the
    // /profile call that login() fires internally.
    setTokens({ access: token, ...(refresh ? { refresh } : {}) });

    login({ access: token, ...(refresh ? { refresh } : {}) })
      .then((student) => {
        if (student?.has_completed_assessment) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      })
      .catch(() => {
        navigate('/onboarding', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--void)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--fs-body)',
        fontWeight: 500,
      }}
    >
      Signing you in…
    </div>
  );
}
