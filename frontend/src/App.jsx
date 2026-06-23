import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './layouts/AppShell.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import RouteFallback from './components/RouteFallback.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

// Landing is lazy so its large GSAP/framer bundle is excluded from the initial JS
// payload delivered to auth and protected routes. All other pages use the data
// router's `lazy` property (already in place) which avoids the React.lazy +
// Suspense "suspended while responding to synchronous input" warning inside a
// data router; Landing is the public entry point loaded by its route element
// directly, so React.lazy + the outer Suspense is appropriate here.
const Landing = React.lazy(() => import('./pages/Landing.jsx'));

/**
 * Routing — data API (createBrowserRouter) so useBlocker is available in
 * Assessment.jsx to intercept the browser Back button mid-assessment.
 *
 * Code-splitting (Change 4): every page except the landing entry is loaded via the
 * data router's native route-level `lazy` property, so each becomes its own chunk
 * fetched on first navigation instead of bloating the initial landing download.
 * `lazy` is the data-router-idiomatic split: the router awaits the chunk during the
 * navigation's loading phase (the current page stays on screen — no flash, and the
 * AppShell nav never blanks), which avoids the "component suspended while responding
 * to synchronous input" error that React.lazy + <Suspense> throws inside a data
 * router. Landing stays eager — it is the public entry point.
 *
 * Public:    /  /how-it-works  /login  /register  /verify-otp  /forgot-password  /reset-password
 * Protected: /onboarding  /assessment  /dashboard  /careers  /results  /roadmap  /profile
 *            — gated by <ProtectedRoute> and wrapped in <AppShell>.
 * Unknown paths fall back to the landing page.
 */
// Wrap a default-exporting page module for the data router's `lazy` (which expects
// a route-properties object — `Component` is the recognised key).
const page = (loader) => () => loader().then((m) => ({ Component: m.default }));

// Root layout: invisible wrapper that fires ScrollToTop on every route change.
// Wrapping the entire tree here means protected, public, and auth routes are
// all covered without adding ScrollToTop to each page individually.
function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
  // public
  { path: '/', element: <Landing /> },
  { path: '/how-it-works', lazy: page(() => import('./pages/HowItWorks.jsx')) },

  // admin (key-gated, not JWT-protected)
  { path: '/admin', lazy: page(() => import('./pages/Admin.jsx')) },
  { path: '/admin/students/:id', lazy: page(() => import('./pages/AdminStudent.jsx')) },

  // auth
  { path: '/login', lazy: page(() => import('./pages/auth/Login.jsx')) },
  { path: '/register', lazy: page(() => import('./pages/auth/Register.jsx')) },
  { path: '/verify-otp', lazy: page(() => import('./pages/auth/VerifyOtp.jsx')) },
  { path: '/forgot-password', lazy: page(() => import('./pages/auth/ForgotPassword.jsx')) },
  { path: '/reset-password', lazy: page(() => import('./pages/auth/ResetPassword.jsx')) },
  { path: '/auth/google/success', lazy: page(() => import('./pages/GoogleAuthSuccess.jsx')) },

  // protected funnel — <ProtectedRoute> gates authentication,
  // <AppShell> provides the persistent nav + starfield backdrop.
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/onboarding', lazy: page(() => import('./pages/Onboarding.jsx')) },
          { path: '/assessment', lazy: page(() => import('./pages/Assessment.jsx')) },
          { path: '/dashboard', lazy: page(() => import('./pages/Dashboard.jsx')) },
          { path: '/careers', lazy: page(() => import('./pages/Careers.jsx')) },
          { path: '/results', lazy: page(() => import('./pages/Results.jsx')) },
          { path: '/roadmap', lazy: page(() => import('./pages/Roadmap.jsx')) },
          { path: '/profile', lazy: page(() => import('./pages/Profile.jsx')) },
        ],
      },
    ],
  },

  // catch-all
  { path: '*', element: <Navigate to="/" replace /> },
  ],
  },
]);

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RouterProvider router={router} fallbackElement={<RouteFallback />} />
    </Suspense>
  );
}
