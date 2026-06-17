'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  avatarUrl?: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  mfaEnabled: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Actions
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;
  devBypass: () => void;
}

/** Mock user used in dev bypass mode — mirrors the seed data. */
export const DEV_MOCK_USER: AuthUser = {
  id: 'dev-00000000-0000-0000-0000-000000000001',
  email: 'owner@demo.clarbit.com',
  firstName: 'Alice',
  lastName: 'Owner',
  role: 'OWNER',
  tenantId: 'dev-00000000-0000-0000-0000-000000000000',
  tenantName: 'Demo Corp',
  tenantSlug: 'demo-corp',
  mfaEnabled: false,
};

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' &&
  process.env['NODE_ENV'] !== 'production';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      setSession: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      clearSession: () => {
        // Remove dev bypass cookie as well
        if (typeof document !== 'undefined') {
          document.cookie = 'dev_session=; path=/; max-age=0';
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      devBypass: () => {
        if (!DEV_BYPASS_ENABLED) return;
        // Set a short-lived cookie that middleware reads for route protection
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
      // Only persist user identity, not the token (token lives in httpOnly cookie in prod)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/** Convenience selector — avoids re-rendering when unrelated state changes. */
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
