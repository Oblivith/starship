import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client, { API_BASE_URL } from '../../api/client.js';
import { AuthScreen, Field, FormError, SubmitButton, toIdentifier, errorMessage, authLink } from './AuthShell.jsx';
import GoogleButton from './GoogleButton.jsx';

/**
 * Register — POST /auth/register { email|phone_number, password } → student_id.
 * The backend issues a (mock) OTP, so we hand off to /verify-otp carrying the
 * student_id it returned.
 */
export default function Register() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) return setError('Enter an email or phone number.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { data } = await client.post('/auth/register', {
        ...toIdentifier(identifier),
        password,
      });
      navigate('/verify-otp', { state: { student_id: data.student_id, identifier: identifier.trim() } });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Free for every student. Start with your email or phone number."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" style={authLink()}>
            Sign in
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
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />
        <SubmitButton loading={loading}>Create account</SubmitButton>
      </form>
      <GoogleButton apiBaseUrl={API_BASE_URL} />
    </AuthScreen>
  );
}
