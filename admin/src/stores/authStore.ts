import { create } from 'zustand';
import { api, ApiError } from '@/lib/api';

interface UserProfile {
  id: number;
  email: string;
  callsign: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'dispatcher' | 'pilot';
  rank: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  login: async (email, password) => {
    const data = await api.post<{ accessToken: string; refreshToken: string; user: UserProfile }>(
      '/api/auth/login',
      { email, password },
    );

    if (data.user.role === 'pilot') {
      throw new ApiError(403, 'Pilot accounts cannot access the admin panel');
    }

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, isAuthenticated: true });
    localStorage.setItem('admin-auth', JSON.stringify({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    }));
  },

  logout: () => {
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    localStorage.removeItem('admin-auth');
  },

  hydrate: async () => {
    const raw = localStorage.getItem('admin-auth');
    if (!raw) { set({ isHydrating: false }); return; }

    try {
      const { accessToken, refreshToken, user } = JSON.parse(raw);
      set({ accessToken, refreshToken, user });

      const fresh = await api.get<UserProfile>('/api/auth/me');
      if (fresh.role === 'pilot') {
        get().logout();
      } else {
        set({ user: fresh, isAuthenticated: true });
        localStorage.setItem('admin-auth', JSON.stringify({ accessToken, refreshToken, user: fresh }));
      }
    } catch {
      get().logout();
    } finally {
      set({ isHydrating: false });
    }
  },
}));
