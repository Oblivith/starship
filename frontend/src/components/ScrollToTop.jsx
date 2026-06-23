import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets scroll to top on every route change, except browser back/forward
 * navigation where the browser's native scroll restoration should be respected.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType(); // 'POP' = back/forward, 'PUSH'/'REPLACE' = link/programmatic

  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);

  return null;
}
