import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';
const SESSION_KEY = 'starship_admin_key';

const SORT_FIELDS = {
  name: 'name',
  email: 'email',
  last_login: 'last_login',
};

export default function Admin() {
  const navigate = useNavigate();

  const [storedKey, setStoredKey] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [keyInput, setKeyInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('student_id');
  const [sortDir, setSortDir] = useState('desc');

  const fetchStudents = useCallback(async (key) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/students?limit=500`, {
        headers: { 'X-Admin-Key': key },
      });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        setStoredKey('');
        setAuthed(false);
        setError('Invalid admin key');
        return;
      }
      if (!res.ok) {
        setError(`Server error ${res.status}`);
        return;
      }
      const data = await res.json();
      setStudents(data.students || []);
      setAuthed(true);
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storedKey) fetchStudents(storedKey);
  }, [storedKey, fetchStudents]);

  function handleKeySubmit(e) {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k) return;
    sessionStorage.setItem(SESSION_KEY, k);
    setStoredKey(k);
  }

  function handleSignOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setStoredKey('');
    setKeyInput('');
    setAuthed(false);
    setStudents([]);
    setError('');
  }

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  }

  const filtered = students
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av = a[sortBy] ?? '';
      let bv = b[sortBy] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  if (!authed) {
    return (
      <div style={styles.page}>
        <div style={styles.lockCard}>
          <div style={styles.lockIcon}>🔐</div>
          <h1 style={styles.lockTitle}>Admin Access</h1>
          <p style={styles.lockSub}>Enter your admin key to view student data.</p>
          {error && <p style={styles.errorText}>{error}</p>}
          <form onSubmit={handleKeySubmit} style={styles.lockForm}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin key"
              autoFocus
              style={styles.input}
            />
            <button type="submit" style={styles.btn}>Unlock</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Admin — Students</h1>
            <p style={styles.pageSub}>{students.length} registered students</p>
          </div>
          <button onClick={handleSignOut} style={styles.signOutBtn}>Sign out</button>
        </div>

        {/* Search + refresh */}
        <div style={styles.toolbar}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ ...styles.input, width: '320px' }}
          />
          <button
            onClick={() => fetchStudents(storedKey)}
            disabled={loading}
            style={{ ...styles.btn, padding: '8px 20px', fontSize: '13px', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        {/* Table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone_number', label: 'Phone' },
                  { key: 'current_class', label: 'Class' },
                  { key: 'preferred_state', label: 'State' },
                  { key: null, label: 'Assessment' },
                  { key: null, label: 'Top Career' },
                  { key: null, label: 'Score' },
                  { key: 'last_login', label: 'Last Login' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{
                      ...styles.th,
                      cursor: key ? 'pointer' : 'default',
                    }}
                  >
                    {label}
                    {key && sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <StudentRow
                  key={s.student_id}
                  student={s}
                  onClick={() => navigate(`/admin/students/${s.student_id}`)}
                />
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} style={styles.emptyCell}>
                    {search ? 'No students match your search.' : 'No students found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={styles.countLabel}>
          Showing {filtered.length} of {students.length} students
        </p>
      </div>
    </div>
  );
}

function StudentRow({ student: s, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.tr,
        background: hovered ? 'rgba(91,82,184,0.10)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <td style={styles.td}>{s.name || '—'}</td>
      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>{s.email || '—'}</td>
      <td style={styles.td}>{s.phone_number || '—'}</td>
      <td style={styles.td}>{s.current_class || '—'}</td>
      <td style={styles.td}>{s.preferred_state || '—'}</td>
      <td style={styles.td}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '12px',
            background: s.is_verified ? 'rgba(29,158,117,0.18)' : 'rgba(216,90,48,0.18)',
            color: s.is_verified ? 'var(--mint)' : 'var(--coral)',
          }}
        >
          {s.is_verified ? 'Verified' : 'Pending'}
        </span>
      </td>
      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>—</td>
      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>—</td>
      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
        {s.last_login ? new Date(s.last_login).toLocaleDateString('en-IN') : '—'}
      </td>
    </tr>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--void)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0 60px',
  },
  container: {
    width: '100%',
    maxWidth: '1280px',
    padding: '40px 28px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  pageTitle: {
    margin: '0 0 4px',
    fontSize: '1.5rem',
    fontWeight: 500,
    color: 'var(--stardust)',
  },
  pageSub: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(15,14,42,0.6)',
    userSelect: 'none',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.12s',
  },
  td: {
    padding: '11px 14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    maxWidth: '220px',
    textOverflow: 'ellipsis',
  },
  emptyCell: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
  countLabel: {
    marginTop: '12px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  lockCard: {
    margin: 'auto',
    marginTop: '15vh',
    padding: '36px 40px',
    background: 'var(--deep)',
    border: '1px solid rgba(91,82,184,0.35)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--glow-violet)',
    minWidth: '340px',
    maxWidth: '400px',
    textAlign: 'center',
  },
  lockIcon: {
    fontSize: '32px',
    marginBottom: '16px',
  },
  lockTitle: {
    margin: '0 0 8px',
    fontSize: '1.3rem',
    fontWeight: 500,
    color: 'var(--stardust)',
  },
  lockSub: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  lockForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    padding: '10px 14px',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
  },
  btn: {
    background: 'var(--gradient-brand)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
    fontWeight: 500,
    padding: '10px 20px',
  },
  signOutBtn: {
    background: 'transparent',
    border: '1px solid rgba(216,90,48,0.5)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--coral)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    padding: '7px 16px',
  },
  errorText: {
    color: 'var(--coral)',
    fontSize: '13px',
    margin: '0 0 12px',
  },
};
