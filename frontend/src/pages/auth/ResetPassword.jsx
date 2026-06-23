import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../../api/client.js';
import { AuthScreen, Field, FormError, Notice, SubmitButton, errorMessage, authLink } from './AuthShell.jsx';

/**
 * ResetPassword — POST /auth/reset-password { student_id, otp, new_password }.
 * The identifier travels in the URL query (?student_id=…), set by
 * ForgotPassword. The OTP is the mocked 123456 (surfaced in the UI). On success
 * we route to /login.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Prefer ?student_id; accept ?token as an alias for robustness.
  const studentId = params.get('student_id') || params.get('token') || null;

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!studentId) return;
    if (!otp.trim()) return setError('Enter the 6-digit code.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await client.post('/auth/reset-password', {
        student_id: Number(studentId),
        otp: otp.trim(),
        new_password: password,
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Set a new password"
      subtitle={done ? undefined : 'Enter the code we sent, then choose a new password.'}
      footer={
        <>
          <Link to="/login" style={authLink()}>
            Back to sign in
          </Link>
        </>
      }
    >
      {!studentId ? (
        <Notice
          tone="warn"
          message={
            <>
              This reset link is missing its details. Please{' '}
              <Link to="/forgot-password" style={authLink({ color: 'var(--warm)' })}>
                request a new reset code
              </Link>
              .
            </>
          }
        />
      ) : done ? (
        <>
          <Notice message="Your password has been updated. You can sign in now." />
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '13px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: 'var(--gradient-brand)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body)',
              fontWeight: 'var(--fw-medium)',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Go to sign in
          </button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <Notice message="Demo mode: your reset code is 123456." />
          <FormError message={error} />
          <Field
            label="Reset code"
            name="otp"
            value={otp}
            onChange={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <Field
            label="New password"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            name="confirm"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />
          <SubmitButton loading={loading}>Update password</SubmitButton>
        </form>
      )}
    </AuthScreen>
  );
}
