import axios from 'axios';

/**
 * STARSHIP API client.
 *
 *  - Base URL comes from .env (VITE_API_BASE_URL); falls back to the local
 *    FastAPI dev server.
 *  - Every request gets the JWT access token from localStorage as a
 *    `Bearer` Authorization header (the backend extracts student_id from it).
 *  - On a 401 the client tries to transparently refresh the access token via
 *    `POST /auth/refresh` (using the stored refresh token) and then retries the
 *    original request. Only if the refresh itself fails do we clear the tokens
 *    and redirect to /login. Concurrent requests that 401 while a refresh is
 *    already in flight are queued and replayed once with the new token, so we
 *    never fire more than one refresh at a time.
 */

export const TOKEN_KEY = 'starship_access_token';
export const REFRESH_KEY = 'starship_refresh_token';

const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';

// Exported so flows that must NOT trigger the global 401→/login redirect
// (e.g. the AuthContext mount rehydrate) can make a bare axios call against the
// same origin without going through this client's response interceptor.
export const API_BASE_URL = baseURL;

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// --- Request: attach JWT from localStorage ---------------------------------
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response: 401 -> refresh access token, then retry ---------------------
//
// Single-flight refresh: the first 401 kicks off the refresh; any other request
// that 401s in the meantime parks itself in `failedQueue` and is resumed (or
// rejected) when the refresh settles.
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

// Guarded redirect — never bounce if we're already sitting on /login.
// Pass reason='session_expired' to show a contextual message on the login page.
function redirectToLogin(reason) {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const url = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
    window.location.assign(url);
  }
}

function failAuth(error, reason) {
  clearTokens();
  redirectToLogin(reason);
  return Promise.reject(error);
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    // Anything that isn't a 401 (or has no config to retry) passes straight through.
    if (status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Loop guard: if the failing call IS the refresh endpoint, or we've already
    // retried this request once, the session is genuinely dead — clear + bounce.
    // Double-401 (refresh itself returning 401) is caught by `isRefreshCall`.
    const isRefreshCall =
      typeof originalRequest.url === 'string' &&
      originalRequest.url.includes('/auth/refresh');
    if (isRefreshCall || originalRequest._retry) {
      return failAuth(error, 'session_expired');
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      // No refresh token to spend — nothing to do but send them to /login.
      return failAuth(error);
    }

    originalRequest._retry = true;

    // A refresh is already running: queue this request and replay it after.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        })
        .catch((queueError) => Promise.reject(queueError));
    }

    // We own the refresh. Use a bare axios call so this interceptor (and the
    // request interceptor's stale-token header) don't re-enter on the refresh.
    isRefreshing = true;
    return new Promise((resolve, reject) => {
      axios
        .post(
          `${baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        )
        .then(({ data }) => {
          // Backend (api.py POST /auth/refresh) returns { access_token, token_type }.
          const newAccess = data?.access_token;
          if (!newAccess) {
            throw new Error('No access_token in refresh response');
          }
          setTokens({ access: newAccess });
          processQueue(null, newAccess);
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          resolve(client(originalRequest));
        })
        .catch((refreshError) => {
          // Refresh failed (expired/revoked refresh token, server error, …):
          // reject everything waiting and send the user to /login with a reason.
          processQueue(refreshError, null);
          clearTokens();
          redirectToLogin('session_expired');
          reject(refreshError);
        })
        .finally(() => {
          isRefreshing = false;
        });
    });
  }
);

// --- Token helpers (used by the auth flow) ---------------------------------
export function setTokens({ access, refresh } = {}) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export default client;
