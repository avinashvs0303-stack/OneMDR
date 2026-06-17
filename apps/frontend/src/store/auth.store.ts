'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as authApi from '@/lib/auth.api';
import type { AuthUser } from '@/lib/auth.api';

// Re-export so consumers only need one import
export type { AuthUser };

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;

  // Real API actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<authApi.LoginResult>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    tenantName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;

  // Dev bypass (local only)
  devBypass: () => void;
}

/** Mock user for dev bypass mode. */
export const DEV_MOCK_USER: AuthUser = {
  id: 'dev-00000000-0000-0000-0000-000000000001',
  email: 'owner@demo.clarbit.com',
  firstName: 'Alice',
  lastName: 'Owner',
  role: 'OWNER',
  tenantId: 'dev-00000000-0000-0000-0000-000000000000',
  mfaEnabled: false,
};

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      setSession: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      clearSession: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'dev_session=; path=/; max-age=0';
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      login: async (email, password, rememberMe) => {
        set({ isLoading: true });
        try {
          const result = await authApi.login({ email, password, rememberMe });
          if (!result.requiresMfa) {
            set({
              user: result.session.user,
              accessToken: result.session.accessToken,
              isAuthenticated: true,
            });
          }
          return result;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const session = await authApi.register(data);
          set({
            user: session.user,
            accessToken: session.accessToken,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          /* ignore network errors on logout */
        }
        get().clearSession();
      },

      devBypass: () => {
        if (!DEV_BYPASS_ENABLED) return;
        if (typeof document !== 'undefined') {
          document.cookie = 'dev_session=true; path=/; max-age=86400; SameSite=Strict';
        }
        set({
          user: DEV_MOCK_USER,
          accessToken: 'dev_bypass_token',
          isAuthenticated: true,
          isLoading: false,
        });
      },
    }),
    {
      name: 'clarbit-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Persist user identity + token (token needed for API Authorization header)
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// Convenience selectors
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useAccessToken = () => useAuthStore((s) => s.accessToken);
