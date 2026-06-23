import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute — gate for the authenticated funnel.
 *
 * `isAuthenticated` is derived from token presence (initialised synchronously
 * from localStorage in AuthContext), so a returning user with a stored token
 * is NOT bounced to /login while the mount /profile rehydrate is still running.
 * If the token turns out to be stale, the rehydrate clears it and a later
 * protected request's 401 interceptor handles the redirect.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
