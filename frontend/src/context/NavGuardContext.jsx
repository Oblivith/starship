import { createContext, useCallback, useContext, useState } from 'react';
import { useBeforeUnload } from 'react-router-dom';

/**
 * NavGuardContext — "you have unsaved progress" protection for the authenticated
 * funnel (BUG 2).
 *
 * The assessment page calls setUnsavedChanges(true) after the first answer is
 * saved and clears it (false) once /submit-assessment succeeds. While the flag
 * is set:
 *   • the AppShell wordmark / profile / logout controls route their action
 *     through a styled confirmation modal instead of navigating immediately, and
 *   • a native beforeunload prompt guards tab close / refresh / leaving the SPA
 *     (useBeforeUnload — the only thing that can interrupt a real page unload;
 *     browsers don't permit a custom modal there).
 *
 * This context handles SPA navigation triggered by AppShell shell controls
 * (wordmark / profile / logout). Assessment.jsx additionally uses useBlocker
 * (data-router API, available after the App.jsx migration to createBrowserRouter)
 * to intercept the browser Back button. The two mechanisms are complementary.
 */

const NavGuardContext = createContext(null);

export function NavGuardProvider({ children }) {
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  // When a guarded control is used while there are unsaved changes, we stash the
  // action (a function) here and show the modal; running it waits for the user's
  // confirmation.
  const [pendingAction, setPendingAction] = useState(null);

  // Native prompt for tab close / refresh / leaving the SPA entirely.
  useBeforeUnload(
    useCallback(
      (e) => {
        if (unsavedChanges) {
          e.preventDefault();
          e.returnValue = ''; // Chrome requires returnValue to be set.
        }
      },
      [unsavedChanges]
    )
  );

  // Run `action` now if it's safe, or defer it behind the modal if there is
  // unsaved progress.
  const requestLeave = useCallback(
    (action) => {
      if (typeof action !== 'function') return;
      if (unsavedChanges) setPendingAction(() => action);
      else action();
    },
    [unsavedChanges]
  );

  const confirmLeave = useCallback(() => {
    setUnsavedChanges(false);
    if (typeof pendingAction === 'function') pendingAction();
    setPendingAction(null);
  }, [pendingAction]);

  const cancelLeave = useCallback(() => setPendingAction(null), []);

  const value = {
    unsavedChanges,
    setUnsavedChanges,
    requestLeave,
    confirmLeave,
    cancelLeave,
    isPrompting: pendingAction != null,
  };

  return <NavGuardContext.Provider value={value}>{children}</NavGuardContext.Provider>;
}

export function useNavGuard() {
  const ctx = useContext(NavGuardContext);
  if (!ctx) throw new Error('useNavGuard must be used within a <NavGuardProvider>');
  return ctx;
}

export default NavGuardContext;
