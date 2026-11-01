import type { Profile, SessionUser } from '@/types';
import { api } from './http';

interface SessionResponse {
  user: SessionUser | null;
}

export const authService = {
  async session() {
    return (await api<SessionResponse>('/auth/session/')).user;
  },

  /** Exchanges the ID token from "Sign in with Google" for a CrackRoom session. */
  async signInWithGoogle(credential: string) {
    return (await api<SessionResponse>('/auth/google/', { method: 'POST', body: { credential } })).user!;
  },

  logout() {
    return api<void>('/auth/logout/', { method: 'POST' });
  },

  deleteAccount() {
    return api<void>('/auth/account/', { method: 'DELETE', body: { confirm: 'DELETE' } });
  },
};

type ProfileInput = Omit<Profile, 'createdAt'>;

export const profileService = {
  save(profile: ProfileInput) {
    return api<Profile>('/profile/', { method: 'PUT', body: profile });
  },

  update(patch: Partial<ProfileInput>) {
    return api<Profile>('/profile/', { method: 'PATCH', body: patch });
  },
};
