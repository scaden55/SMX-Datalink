import { create } from 'zustand';
import { api } from '../lib/api';
import { useAuthStore } from './authStore';
import type { UserProfile } from '@acars/shared';

interface AdminState {
  impersonating: boolean;
  originalAccessToken: string | null;
  originalRefreshToken: string | null;
  originalUser: UserProfile | null;

  startImpersonation: (userId: number) => Promise<void>;
  stopImpersonation: () => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  impersonating: false,
  originalAccessToken: null,
  originalRefreshToken: null,
  originalUser: null,

  startImpersonation: async (userId: number) => {
    const authState = useAuthStore.getState();
    // Save original tokens before swapping
    set({
      originalAccessToken: authState.accessToken,
      originalRefreshToken: authState.refreshToken,
      originalUser: authState.user,
      impersonating: true,
    });

    const result = await api.post<{ accessToken: string }>(`/api/admin/users/${userId}/impersonate`);
    // Use a sentinel refresh token during impersonation to prevent silent
    // token refresh from reverting to admin identity (the impersonation endpoint
    // only returns an access token — no refresh token is issued)
    authState.setTokens(result.accessToken, '__impersonating__');
    await authState.hydrate();
  },

  stopImpersonation: () => {
    const { originalAccessToken, originalRefreshToken, originalUser } = get();
    if (originalAccessToken && originalRefreshToken) {
      const authState = useAuthStore.getState();
      authState.setTokens(originalAccessToken, originalRefreshToken);
      useAuthStore.setState({ user: originalUser, isAuthenticated: true });
    }
    set({
      impersonating: false,
      originalAccessToken: null,
      originalRefreshToken: null,
      originalUser: null,
    });
  },
}));
