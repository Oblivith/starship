import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthScreen, Field, FormError, Notice, SubmitButton, errorMessage, authLink } from './AuthShell.jsx';

/**
 * VerifyOtp — POST /auth/verify-otp { student_id, otp } → tokens → /onboarding.
 * The OTP is mocked server-side (always 123456), surfaced in the UI below.
 * Resend → POST /auth/resend-otp { student_id }.
 *
 * student_id arrives via router state from Register (or Login's OTP fallback).
 */
export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const studentId = location.state?.student_id ?? null;
  const identifier = location.state?.identifier ?? '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!studentId) return;
    if (!otp.trim()) return setError('Enter the 6-digit code.');

    setLoading(true);
    try {
      const { data } = await client.post('/auth/verify-otp', { student_id: studentId, otp: otp.trim() });
      await login({ access: data.access_token, refresh: data.refresh_token });
      navigate('/onboarding');
    } catch (err) {
      setError(errorMessage(err, 'That code did not work.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    if (!studentId) return;
    setResending(true);
    try {
      await client.post('/auth/resend-otp', { student_id: studentId });
      setNotice('A new code has been sent (mock).');
    } catch (err) {
      setError(errorMessage(err, 'Could not resend the code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthScreen
      title="Verify your account"
      subtitle={identifier ? `Enter the code we sent to ${identifier}.` : 'Enter the 6-digit code we sent you.'}
      footer={
        <>
          Wrong details?{' '}
          <Link to="/register" style={authLink()}>
            Start over
          </Link>
        </>
      }
    >
      {!studentId ? (
        <Notice
          tone="warn"
          message={
            <>
              We don’t have an account to verify. Please{' '}
              <Link to="/register" style={authLink({ color: 'var(--warm)' })}>
                register
              </Link>{' '}
              first.
            </>
          }
        />
      ) : (
        <form onSubmit={submit} noValidate>
          <Notice message="Demo mode: your verification code is 123456." />
          <FormError message={error} />
          {notice && <Notice message={notice} />}
          <Field
            label="Verification code"
            name="otp"
            value={otp}
            onChange={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <SubmitButton loading={loading}>Verify &amp; continue</SubmitButton>
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '11px 16px',
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              border: '1px solid rgba(200,184,255,0.28)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-sans)',
              cursor: resending ? 'default' : 'pointer',
              opacity: resending ? 0.6 : 1,
            }}
          >
            {resending ? 'Resending…' : 'Resend code'}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
