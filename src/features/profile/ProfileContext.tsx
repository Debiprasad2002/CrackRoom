import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '@/types';
import { clearAll, readJSON, writeJSON } from '@/lib/storage';
import { USING_SAMPLE_DATA } from '@/services/config';
import { profileService } from '@/services/authService';
import { errorMessage } from '@/services/http';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';

interface ProfileContextValue {
  profile: Profile | null;
  /** Resolves once the profile is stored; rejects with a readable error. */
  saveProfile: (profile: Profile) => Promise<void>;
  /** Applies immediately and syncs in the background; rolls back if the server refuses. Resolves to whether it stuck. */
  updateProfile: (patch: Partial<Profile>) => Promise<boolean>;
  recentRoomId: string | null;
  setRecentRoomId: (id: string) => void;
  resetLocalData: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function stripCreatedAt({ createdAt: _createdAt, ...rest }: Partial<Profile>) {
  return rest;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const notify = useToast();
  const [localProfile, setLocalProfile] = useState<Profile | null>(() =>
    USING_SAMPLE_DATA ? readJSON<Profile | null>('profile', null) : null,
  );
  const [recentRoomId, setRecent] = useState<string | null>(() => readJSON<string | null>('recentRoom', null));
  const { setProfile: setSessionProfile } = auth;
  const profile = USING_SAMPLE_DATA ? localProfile : (auth.user?.profile ?? null);

  const saveProfile = useCallback(
    async (next: Profile) => {
      if (USING_SAMPLE_DATA) {
        setLocalProfile(next);
        writeJSON('profile', next);
        return;
      }
      setSessionProfile(await profileService.save(stripCreatedAt(next) as Omit<Profile, 'createdAt'>));
    },
    [setSessionProfile],
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      if (USING_SAMPLE_DATA) {
        setLocalProfile((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...patch };
          writeJSON('profile', next);
          return next;
        });
        return Promise.resolve(true);
      }
      if (!profile) return Promise.resolve(false);
      const before = profile;
      setSessionProfile({ ...profile, ...patch });
      return profileService.update(stripCreatedAt(patch)).then(
        (saved) => {
          setSessionProfile(saved);
          return true;
        },
        (e) => {
          setSessionProfile(before);
          notify({ tone: 'error', title: 'Changes not saved', description: errorMessage(e) });
          return false;
        },
      );
    },
    [profile, setSessionProfile, notify],
  );

  const setRecentRoomId = useCallback((id: string) => {
    setRecent(id);
    writeJSON('recentRoom', id);
  }, []);

  const resetLocalData = useCallback(() => {
    clearAll();
    // Every store reads from storage on mount, so a full reload is the simplest clean slate.
    window.location.assign('/welcome');
  }, []);

  const value = useMemo(
    () => ({ profile, saveProfile, updateProfile, recentRoomId, setRecentRoomId, resetLocalData }),
    [profile, saveProfile, updateProfile, recentRoomId, setRecentRoomId, resetLocalData],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

/** For screens that only render after onboarding; the router guarantees a profile exists. */
export function useRequiredProfile() {
  const { profile, ...rest } = useProfile();
  if (!profile) throw new Error('Profile required');
  return { profile, ...rest };
}
