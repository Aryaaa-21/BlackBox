import { create } from 'zustand';
import { User, UserRole, ApiResponse, AuthStatus } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: AuthStatus;
  authInitialized: boolean;
  error: string | null;

  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuth: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for 401 custom event from api.ts
  if (typeof window !== 'undefined') {
    window.addEventListener('blackbox:auth-expired', () => {
      // If we are currently offline, don't clear the local user session
      if (navigator.onLine) {
        localStorage.removeItem('blackbox_token');
        localStorage.removeItem('blackbox_user');
        socketService.disconnect();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'unauthenticated',
        });
      }
    });
  }

  // Load cached token and user for offline resilience
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('blackbox_token') : null;
  const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('blackbox_user') : null;
  let initialUser: User | null = null;
  if (storedUserRaw) {
    try {
      initialUser = JSON.parse(storedUserRaw);
    } catch {
      localStorage.removeItem('blackbox_user');
    }
  }

  return {
    user: initialUser,
    token: storedToken,
    isAuthenticated: Boolean(storedToken && initialUser),
    isLoading: false,
    authStatus: 'checking',
    authInitialized: false,
    error: null,

    initializeAuth: async () => {
      const currentToken = localStorage.getItem('blackbox_token');

      // If no token exists at all, immediately mark unauthenticated
      if (!currentToken) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'unauthenticated',
          authInitialized: true,
          isLoading: false,
        });
        return;
      }

      set({ isLoading: true, authStatus: 'checking' });

      try {
        const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');
        const user = response.data.data.user;

        localStorage.setItem('blackbox_user', JSON.stringify(user));

        // Connect authenticated socket
        socketService.connect(currentToken);

        set({
          user,
          token: currentToken,
          isAuthenticated: true,
          authStatus: 'authenticated',
          authInitialized: true,
          isLoading: false,
          error: null,
        });
      } catch (err: unknown) {
        const error = err as { code?: string };

        // Differentiate server unreachable from genuine 401 unauthenticated
        if (error.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine) {
          const cachedUserRaw = localStorage.getItem('blackbox_user');
          if (cachedUserRaw) {
            try {
              const cachedUser = JSON.parse(cachedUserRaw);
              console.log('[Auth] Server unreachable during init; preserving cached offline session for', cachedUser.email);
              set({
                user: cachedUser,
                token: currentToken,
                isAuthenticated: true,
                authStatus: 'server_unavailable',
                authInitialized: true,
                isLoading: false,
              });
              return;
            } catch {
              // Ignore parse error
            }
          }

          set({
            user: null,
            token: currentToken,
            isAuthenticated: false,
            authStatus: 'server_unavailable',
            authInitialized: true,
            isLoading: false,
          });
          return;
        }

        // True authentication failure (e.g. expired or invalid token)
        localStorage.removeItem('blackbox_token');
        localStorage.removeItem('blackbox_user');
        socketService.disconnect();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          authStatus: 'unauthenticated',
          authInitialized: true,
          isLoading: false,
        });
      }
    },

    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', {
          email,
          password,
        });

        const { user, token } = response.data.data;
        localStorage.setItem('blackbox_token', token);
        localStorage.setItem('blackbox_user', JSON.stringify(user));

        // Connect authenticated real-time stream
        socketService.connect(token);

        set({
          user,
          token,
          isAuthenticated: true,
          authStatus: 'authenticated',
          isLoading: false,
          error: null,
        });
      } catch (err: unknown) {
        const error = err as { message?: string };
        set({
          error: error.message || 'Login failed',
          isLoading: false,
        });
        throw err;
      }
    },

    register: async (name: string, email: string, password: string, role?: UserRole) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', {
          name,
          email,
          password,
          role: role || 'FIELD_OPERATOR',
        });

        const { user, token } = response.data.data;
        localStorage.setItem('blackbox_token', token);
        localStorage.setItem('blackbox_user', JSON.stringify(user));

        // Connect authenticated real-time stream
        socketService.connect(token);

        set({
          user,
          token,
          isAuthenticated: true,
          authStatus: 'authenticated',
          isLoading: false,
          error: null,
        });
      } catch (err: unknown) {
        const error = err as { message?: string };
        set({
          error: error.message || 'Registration failed',
          isLoading: false,
        });
        throw err;
      }
    },

    refreshUser: async () => {
      try {
        const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');
        const user = response.data.data.user;
        localStorage.setItem('blackbox_user', JSON.stringify(user));
        set({ user });
      } catch (err) {
        console.warn('[Auth] Failed to refresh user profile:', err);
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await api.post('/auth/logout');
      } catch {
        // Proceed even if network request fails
      } finally {
        get().clearAuth();
      }
    },

    clearAuth: () => {
      localStorage.removeItem('blackbox_token');
      localStorage.removeItem('blackbox_user');
      socketService.disconnect();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authStatus: 'unauthenticated',
        isLoading: false,
        error: null,
      });
    },

    clearError: () => set({ error: null }),
  };
});
