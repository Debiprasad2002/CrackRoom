import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile, SessionUser } from '@/types';
import { USING_SAMPLE_DATA } from '@/services/config';
import { authService } from '@/services/authService';
import { errorMessage } from '@/services/http';
import { removeKey } from '@/lib/storage';

/**
 * `local`: no server configured; the app runs on this device only.
 * Otherwise the server session decides who is signed in.
 */
export type AuthStatus = 'local' | 'loading' | 'unreachable' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  error: string | null;
  retry: () => void;
  /** Signs in (creating the account on first use) with a Google ID token. */
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Keeps the session copy of the profile current after onboarding or edits. */
  setProfile: (profile: Profile) => void;
  /** After the account is deleted. */
  forget: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Device-only state that belongs to whoever was signed in. */
function clearDeviceSession() {
  removeKey('timer');
  removeKey('recentRoom');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(USING_SAMPLE_DATA ? 'local' : 'loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (USING_SAMPLE_DATA) return;
    let cancelled = false;
    setStatus('loading');
    authService.session().then(
      (current) => {
        if (cancelled) return;
        setUser(current);
        setStatus(current ? 'signedIn' : 'signedOut');
      },
      (e) => {
        if (cancelled) return;
        setError(errorMessage(e));
        setStatus('unreachable');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signInWithGoogle = useCallback(async (credential: string) => {
    const next = await authService.signInWithGoogle(credential);
    clearDeviceSession();
    setUser(next);
    setStatus('signedIn');
  }, []);

  const forget = useCallback(() => {
    clearDeviceSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
    // Stops Google from silently signing the student straight back in.
    window.google?.accounts.id.disableAutoSelect();
    forget();
  }, [forget]);

  const setProfile = useCallback((profile: Profile) => {
    setUser((current) => (current ? { ...current, profile } : current));
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ status, user, error, retry, signInWithGoogle, signOut, setProfile, forget }),
    [status, user, error, retry, signInWithGoogle, signOut, setProfile, forget],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
