import { create } from 'zustand';
import { authApi } from '../services/api';
import type { UserProfile } from '../services/api';

interface AuthStore {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('vr_token'),
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem('vr_token', token);
    set({ token, user, loading: false });
  },

  logout: () => {
    localStorage.removeItem('vr_token');
    set({ token: null, user: null, loading: false });
  },

  hydrate: async () => {
    const token = localStorage.getItem('vr_token');
    if (!token) { set({ loading: false }); return; }
    try {
      const user = await authApi.me();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('vr_token');
      set({ token: null, user: null, loading: false });
    }
  },
}));
