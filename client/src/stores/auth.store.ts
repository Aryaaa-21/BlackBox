import { create } from 'zustand';
import { authApi, type LoginInput, type RegisterInput } from '../api/auth';
import { ApiRequestError } from '../api/http';
import { clearSession, getCachedSession, saveSession } from '../db';
import type { User } from '../types';
import { canUseOfflineCache } from '../services/sync-policy';
import { connectivity } from '../services/connectivity';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  loadCurrentUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  error: null,

  login: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.login(input);
      await saveSession({ userId: result.user.id, user: result.user, token: result.token, savedAt: new Date().toISOString() });
      set({ user: result.user, loading: false, initialized: true });
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in';
      set({ loading: false, error: message });
      throw error;
    }
  },

  register: async (input) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.register(input);
      await saveSession({ userId: result.user.id, user: result.user, token: result.token, savedAt: new Date().toISOString() });
      set({ user: result.user, loading: false, initialized: true });
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register';
      set({ loading: false, error: message });
      throw error;
    }
  },

  loadCurrentUser: async () => {
    set({ loading: true, error: null });
    if (connectivity.getSnapshot().browser === 'offline') {
      const local = await getCachedSession();
      set({ user: local?.user || null, loading: false, initialized: true });
      return local?.user || null;
    }
    // A fresh public browser has no session to validate. Avoid blocking the
    // landing/login shell on an unnecessary /auth/me request when the API is
    // slow or unavailable.
    const localSession = await getCachedSession();
    if (!localSession) {
      set({ user: null, loading: false, initialized: true });
      return null;
    }
    try {
      const user = await authApi.me();
      await saveSession({ userId: user.id, user, token: localSession.userId === user.id ? localSession.token : '', savedAt: new Date().toISOString() });
      set({ user, loading: false, initialized: true });
      return user;
    } catch (error) {
      if (localSession && canUseOfflineCache(error)) {
        set({ user: localSession.user, loading: false, initialized: true });
        return localSession.user;
      }
      if (localSession && error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) await clearSession(localSession.userId);
      set({ user: null, loading: false, initialized: true, error: error instanceof Error ? error.message : 'Unable to verify session' });
      return null;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    const currentUser = useAuthStore.getState().user;
    try {
      await authApi.logout();
    } finally {
      await clearSession(currentUser?.id);
      set({ user: null, loading: false, initialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
