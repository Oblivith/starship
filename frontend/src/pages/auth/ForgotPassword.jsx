import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../../api/client.js';
import { AuthScreen, Field, FormError, Notice, SubmitButton, toIdentifier, errorMessage, authLink } from './AuthShell.jsx';

/**
 * ForgotPassword — POST /auth/forgot-password { email|phone_number }.
 * The backend returns a student_id only when the account exists (and stays
 * deliberately vague otherwise). When we get one, hand off to /reset-password
 * with the student_id as a query param; otherwise show the neutral message.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!identifier.trim()) return setError('Enter your email or phone number.');

    setLoading(true);
    try {
      const { data } = await client.post('/auth/forgot-password', toIdentifier(identifier));
      if (data?.student_id) {
        navigate(`/reset-password?student_id=${data.student_id}`);
      } else {
        setNotice('If that account exists, a reset code has been sent (mock).');
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not start password reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="We’ll send a one-time code to verify it’s you."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" style={authLink()}>
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        {notice && <Notice message={notice} />}
        <Field
          label="Email or phone"
          name="identifier"
          value={identifier}
          onChange={setIdentifier}
          placeholder="you@example.com or 9876543210"
          autoComplete="username"
          autoFocus
        />
        <SubmitButton loading={loading}>Send reset code</SubmitButton>
      </form>
    </AuthScreen>
  );
}
