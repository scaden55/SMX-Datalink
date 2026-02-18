import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, LoginResponse } from '@acars/shared';
import { api, ApiError } from '../lib/api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isHydrating: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isHydrating: false,

      login: async (email, password) => {
        const data = await api.post<LoginResponse>('/api/auth/login', { email, password });
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          isAuthenticated: true,
        });
      },

      register: async (email, password, firstName, lastName) => {
        const data = await api.post<LoginResponse>('/api/auth/register', {
          email, password, firstName, lastName,
        });
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        const { accessToken, refreshToken } = get();
        // Fire-and-forget server-side logout
        if (accessToken && refreshToken) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {});
        }
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      hydrate: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isAuthenticated: false, isHydrating: false });
          return;
        }

        set({ isHydrating: true });
        try {
          const user = await api.get<UserProfile>('/api/auth/me');
          set({ user, isAuthenticated: true, isHydrating: false });
        } catch (err) {
          // If it's a 401 the api client already tried refresh.
          // If that also failed, clearAuth was called. Just ensure clean state.
          if (err instanceof ApiError && err.status === 401) {
            set({ isHydrating: false });
          } else {
            // Network error etc — keep tokens, don't sign out
            set({ isHydrating: false, isAuthenticated: true });
          }
        }
      },
    }),
    {
      name: 'acars-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
