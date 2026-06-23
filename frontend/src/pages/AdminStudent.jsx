import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';
const SESSION_KEY = 'starship_admin_key';

export default function AdminStudent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = sessionStorage.getItem(SESSION_KEY);
    if (!key) {
      navigate('/admin', { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/admin/students/${id}`, {
          headers: { 'X-Admin-Key': key },
        });
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem(SESSION_KEY);
          navigate('/admin', { replace: true });
          return;
        }
        if (res.status === 404) {
          setError('Student not found');
          return;
        }
        if (!res.ok) {
          setError(`Server error ${res.status}`);
          return;
        }
        const data = await res.json();
        setStudent(data);

        // Fetch results in parallel
        setResultsLoading(true);
        try {
          const rRes = await fetch(`${API_BASE}/admin/students/${id}/results`, {
            headers: { 'X-Admin-Key': key },
          });
          if (rRes.ok) {
            setResults(await rRes.json());
          }
          // 404 = no completed assessment — leave results null (handled below)
        } catch {
          // results unavailable — non-fatal
        } finally {
          setResultsLoading(false);
        }
      } catch {
        setError('Could not connect to server');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'var(--text-secondary)', padding: '60px 28px' }}>Loading…</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <button onClick={() => navigate('/admin')} style={styles.backBtn}>← Back</button>
          <p style={{ color: 'var(--coral)', marginTop: '20px' }}>{error || 'Student not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Back */}
        <button onClick={() => navigate('/admin')} style={styles.backBtn}>← Back to students</button>

        {/* Profile card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Profile</h2>
          <div style={styles.grid}>
            <Field label="Student ID" value={student.student_id} />
            <Field label="Name" value={student.name} />
            <Field label="Email" value={student.email} />
            <Field label="Phone" value={student.phone_number} />
            <Field label="Class" value={student.current_class} />
            <Field label="Preferred State" value={student.preferred_state} />
            <Field
              label="Annual Family Income"
              value={
                student.annual_family_income_inr != null
                  ? `₹${Number(student.annual_family_income_inr).toLocaleString('en-IN')}`
                  : null
              }
            />
            <Field
              label="Verified"
              value={
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    background: student.is_verified
                      ? 'rgba(29,158,117,0.18)'
                      : 'rgba(216,90,48,0.18)',
                    color: student.is_verified ? 'var(--mint)' : 'var(--coral)',
                  }}
                >
                  {student.is_verified ? 'Yes' : 'No'}
                </span>
              }
            />
            <Field
              label="Last Login"
              value={
                student.last_login
                  ? new Date(student.last_login).toLocaleString('en-IN')
                  : null
              }
            />
          </div>
        </div>

        {/* Results */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Assessment Results</h2>
          {resultsLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading results…</p>
          ) : results ? (
            <div style={styles.grid}>
              {Object.entries(results.riasec_scores || {}).map(([k, v]) => (
                <Field key={k} label={`RIASEC · ${k}`} value={`${Math.round(v)}%`} />
              ))}
              {Object.entries(results.aptitude_scores || {}).map(([k, v]) => (
                <Field key={k} label={k.replace(/_/g, ' ')} value={`${Math.round(v)}%`} />
              ))}
            </div>
          ) : (
            <EmptyNote icon="📋" text="No completed assessment found for this student." />
          )}
        </div>

        {/* Top career matches */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Top 10 Career Matches</h2>
          {resultsLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</p>
          ) : results && results.career_matches?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results.career_matches.map((c, i) => (
                <div key={c.name} style={styles.careerRow}>
                  <span style={styles.careerRank}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '14px' }}>{c.name}</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: c.score >= 60 ? 'var(--mint)' : c.score >= 40 ? 'var(--gold)' : 'var(--coral)',
                  }}>{c.score}%</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote icon="🚀" text="No career match data — student has not completed the assessment." />
          )}
        </div>

        {/* Scholarship matches */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Scholarship Matches</h2>
          {resultsLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</p>
          ) : results && results.scholarships?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results.scholarships.map((s, i) => (
                <div key={i} style={styles.scholarshipRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{s.scholarship_name || s.name}</div>
                    {s.amount_inr != null && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        ₹{Number(s.amount_inr).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  {s.provider && (
                    <span style={{ fontSize: '12px', color: 'var(--stardust)' }}>{s.provider}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote icon="🎓" text="No scholarship matches — student has not completed the assessment." />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.fieldValue}>{value ?? '—'}</span>
    </div>
  );
}

function EmptyNote({ icon, text }) {
  return (
    <div style={styles.emptyNote}>
      <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>{icon}</span>
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--void)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    padding: '0 0 60px',
  },
  container: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '40px 28px',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    padding: '7px 16px',
    marginBottom: '28px',
    display: 'inline-block',
  },
  card: {
    background: 'var(--deep)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 'var(--radius-card)',
    padding: '28px 32px',
    marginBottom: '20px',
  },
  cardTitle: {
    margin: '0 0 20px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--stardust)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  fieldValue: {
    fontSize: '15px',
    color: 'var(--text-primary)',
  },
  emptyNote: {
    textAlign: 'center',
    padding: '32px 20px',
    border: '1px dashed rgba(255,255,255,0.10)',
    borderRadius: 'var(--radius-md)',
  },
  careerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-md)',
  },
  careerRank: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    minWidth: '20px',
  },
  scholarshipRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-md)',
  },
};
