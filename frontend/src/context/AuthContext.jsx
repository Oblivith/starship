import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import client, {
  API_BASE_URL,
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '../api/client.js';

/**
 * AuthContext — single source of truth for the authenticated session.
 *
 * State:
 *   student      {object|null}  profile from GET /profile
 *   accessToken  {string|null}  JWT (mirrors localStorage via api/client.js)
 *
 * On mount it reads the stored token and rehydrates `student` from GET /profile.
 * That rehydrate call is made with a BARE axios instance (not the shared
 * `client`) on purpose: the shared client's 401 interceptor force-redirects to
 * /login, but the spec for the mount check is "if 401 → clear tokens silently,
 * no redirect". A bare call lets us swallow the 401 here.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialise synchronously from localStorage so a token-holder is treated as
  // authenticated on the very first render (no flash-bounce to /login while the
  // /profile rehydrate is still in flight).
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [student, setStudent] = useState(null);
  // TASK 1 — the engine result lives here so Dashboard/Results render instantly
  // (set after /submit-assessment, restored on mount for completed students).
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Mount rehydrate -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();

    if (!token) {
      setLoading(false);
      return;
    }

    // Bare axios call — deliberately bypasses the shared client's 401 redirect.
    axios
      .get(`${API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000,
      })
      .then((res) => {
        if (cancelled) return;
        setStudent(res.data);
        setAccessToken(token);
        // TASK 1 — restore a completed student's results into context so the
        // Dashboard/Results pages don't each have to self-fetch. Bare axios
        // (like the profile call above) so a transient failure never trips the
        // shared client's 401 → /login redirect ("no redirect on mount").
        if (res.data?.has_completed_assessment) {
          axios
            .get(`${API_BASE_URL}/results`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30000,
            })
            .then((r) => {
              if (!cancelled) setResults(r.data?.results || null);
            })
            .catch(() => {
              /* non-fatal — pages fall back to their own GET /results */
            });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          // Stale/invalid token → clear silently, no redirect on mount.
          clearTokens();
          setAccessToken(null);
          setStudent(null);
        }
        // Other errors (network, server down): keep the token, leave student
        // null. The user isn't logged out over a transient failure.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // --- login ---------------------------------------------------------------
  // tokens: { access, refresh }. studentData optional; when omitted we fetch
  // the profile so the shell can show the student's name immediately.
  const login = useCallback(async (tokens = {}, studentData = null) => {
    setTokens({ access: tokens.access, refresh: tokens.refresh });
    setAccessToken(tokens.access ?? getAccessToken());

    if (studentData) {
      setStudent(studentData);
      return studentData;
    }
    try {
      const res = await client.get('/profile');
      setStudent(res.data);
      return res.data;
    } catch {
      // Non-fatal: the session is valid, the name just isn't loaded yet.
      return null;
    }
  }, []);

  // --- logout --------------------------------------------------------------
  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      // Best-effort server-side revoke; never block logout on it.
      try {
        await client.post('/auth/logout', { refresh_token: refresh });
      } catch {
        /* ignore */
      }
    }
    clearTokens();
    setAccessToken(null);
    setStudent(null);
    setResults(null); // TASK 1 — never leak the previous student's results
  }, []);

  // --- refreshProfile ------------------------------------------------------
  // Re-pull /profile after a PATCH so the shell/profile page stay in sync.
  const refreshProfile = useCallback(async () => {
    try {
      const res = await client.get('/profile');
      setStudent(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const value = {
    student,
    accessToken,
    results,
    setResults,
    isAuthenticated: !!accessToken,
    loading,
    login,
    logout,
    refreshProfile,
    setStudent,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}

export default AuthContext;
