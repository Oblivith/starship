import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client, { API_BASE_URL } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthScreen, Field, FormError, SubmitButton, toIdentifier, errorMessage, authLink } from './AuthShell.jsx';
import GoogleButton from './GoogleButton.jsx';

/**
 * Login — POST /auth/login { email|phone_number, password } → tokens.
 * On success: AuthContext.login(tokens) (which also rehydrates the profile),
 * then into the funnel at /onboarding.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('reason') === 'session_expired'
      ? 'Your session has expired. Please sign in again.'
      : ''
  );
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) return setError('Enter your email or phone number.');
    if (!password) return setError('Enter your password.');

    setLoading(true);
    try {
      const { data } = await client.post('/auth/login', {
        ...toIdentifier(identifier),
        password,
      });

      if (data?.access_token) {
        await login({ access: data.access_token, refresh: data.refresh_token });
        navigate('/onboarding');
      } else {
        // Backend fell back to OTP (password not set on this account).
        setError('This account uses a one-time code. Please register or verify via OTP.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not sign you in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to pick up your assessment and results."
      footer={
        <>
          New here?{' '}
          <Link to="/register" style={authLink()}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        <Field
          label="Email or phone"
          name="identifier"
          value={identifier}
          onChange={setIdentifier}
          placeholder="you@example.com or 9876543210"
          autoComplete="username"
          autoFocus
        />
        <Field
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 18 }}>
          <Link to="/forgot-password" style={authLink({ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' })}>
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
      <GoogleButton apiBaseUrl={API_BASE_URL} />
    </AuthScreen>
  );
}
