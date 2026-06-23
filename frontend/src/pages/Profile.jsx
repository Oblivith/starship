import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Select, FormError, Notice, SubmitButton } from './auth/AuthShell.jsx';
import { CLASS_OPTIONS, INDIAN_STATES } from '../data/constants.js';
import { useSoundManager } from '../components/SoundManager.jsx';

/**
 * Profile — view + edit the student record.
 *   GET   /profile  (rehydrated into AuthContext.student)
 *   PATCH /profile  { name, current_class, preferred_state, annual_family_income_inr, phone_number }
 *
 * Email is registration-bound and not editable via PATCH, so it's shown
 * read-only. Field names mirror api.py exactly.
 */
export default function Profile() {
  const navigate = useNavigate();
  const { student, refreshProfile, setResults, setStudent } = useAuth();
  const { playClick } = useSoundManager();

  const [name, setName] = useState('');
  const [currentClass, setCurrentClass] = useState('');
  const [state, setState] = useState('');
  const [income, setIncome] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Re-take confirmation state
  const [confirming, setConfirming] = useState(false);
  const [retakeLoading, setRetakeLoading] = useState(false);
  const [retakeError, setRetakeError] = useState('');

  // Keep the form in sync with the loaded profile.
  useEffect(() => {
    if (!student) return;
    setName(student.name || '');
    setCurrentClass(student.current_class || '');
    setState(student.preferred_state || '');
    setIncome(student.annual_family_income_inr != null ? String(student.annual_family_income_inr) : '');
    setPhone(student.phone_number || '');
  }, [student]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);

    const payload = {};
    if (name.trim()) payload.name = name.trim();
    if (currentClass) payload.current_class = currentClass;
    if (state) payload.preferred_state = state;
    if (income !== '') {
      const n = Number(income);
      if (Number.isNaN(n) || n < 0) return setError('Enter a valid annual budget (₹0 or more).');
      payload.annual_family_income_inr = n;
    }
    if (phone.trim()) payload.phone_number = phone.trim();

    if (Object.keys(payload).length === 0) return setError('Nothing to update yet.');

    setLoading(true);
    try {
      await client.patch('/profile', payload);
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save your changes.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = async () => {
    playClick();
    setRetakeLoading(true);
    setRetakeError('');
    try {
      await client.delete('/assessment');
      setResults(null);
      // Mark the profile as no-longer-completed so gates re-evaluate correctly.
      setStudent((prev) => prev ? { ...prev, has_completed_assessment: false } : prev);
      navigate('/assessment');
    } catch (err) {
      setRetakeError(err?.response?.data?.error || 'Could not clear your assessment. Please try again.');
      setRetakeLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: 'clamp(28px, 6vw, 64px) 20px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: 'min(480px, 100%)' }}
      >
        <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
          Your profile
        </p>
        <h1
          style={{
            fontSize: 'var(--fs-section)',
            fontWeight: 'var(--fw-medium)',
            lineHeight: 'var(--lh-tight)',
            margin: '0 0 24px',
            color: 'var(--text-primary)',
          }}
        >
          Account details
        </h1>

        <div
          style={{
            background: 'var(--deep)',
            border: '1px solid rgba(200,184,255,0.12)',
            borderRadius: 'var(--radius-card)',
            padding: 'clamp(22px, 4vw, 30px)',
          }}
        >
          {student?.email && (
            <div style={{ marginBottom: 18 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-medium)',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Email
              </span>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body)' }}>{student.email}</div>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            <FormError message={error} />
            {saved && <Notice message="Your profile has been updated." />}

            <Field label="Name" name="name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
            <Select
              label="Current class"
              name="current_class"
              value={currentClass}
              onChange={setCurrentClass}
              options={CLASS_OPTIONS}
              placeholder="Select your class"
            />
            <Select
              label="State"
              name="state"
              value={state}
              onChange={setState}
              options={INDIAN_STATES}
              placeholder="Select your state"
            />
            <Field
              label="Annual education budget (₹)"
              name="income"
              type="number"
              value={income}
              onChange={setIncome}
              placeholder="e.g. 200000"
              inputMode="numeric"
            />
            <Field
              label="Phone number"
              name="phone"
              value={phone}
              onChange={setPhone}
              placeholder="Optional"
              inputMode="tel"
              autoComplete="tel"
            />
            <SubmitButton loading={loading}>Save changes</SubmitButton>
          </form>
        </div>

        {/* Re-take assessment — coral outline button + inline confirmation.
            The wrapper always reserves min-height so the layout doesn't jump
            when the confirmation box replaces the button. No position:fixed. */}
        <div style={{ marginTop: 28, minHeight: 112 }}>
          {!confirming ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--coral)',
                  color: 'var(--coral)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 20px',
                  fontSize: 'var(--fs-body-sm)',
                  fontWeight: 'var(--fw-medium)',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                }}
              >
                Re-take assessment
              </button>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--deep)',
                border: '1px solid var(--violet)',
                borderRadius: 'var(--radius-card)',
                padding: '20px 22px',
              }}
            >
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-body-sm)',
                  lineHeight: 'var(--lh-body)',
                  margin: '0 0 16px',
                }}
              >
                This will clear your results and career matches. This cannot be undone.
              </p>
              {retakeError && (
                <p style={{ color: 'var(--coral)', fontSize: 'var(--fs-body-sm)', margin: '0 0 12px' }}>
                  {retakeError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={retakeLoading}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--coral)',
                    color: 'var(--coral)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 16px',
                    fontSize: 'var(--fs-body-sm)',
                    fontWeight: 'var(--fw-medium)',
                    fontFamily: 'var(--font-sans)',
                    cursor: retakeLoading ? 'not-allowed' : 'pointer',
                    opacity: retakeLoading ? 0.6 : 1,
                  }}
                >
                  {retakeLoading ? 'Clearing…' : 'Yes, re-take'}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirming(false); setRetakeError(''); }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(200,184,255,0.25)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 16px',
                    fontSize: 'var(--fs-body-sm)',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
