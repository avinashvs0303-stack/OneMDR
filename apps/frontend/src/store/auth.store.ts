'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser {
  id: string; // Our users.id (from app_metadata.user_id)
  supabaseId: string; // Supabase auth.users.id
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST' | 'SUPER_ADMIN';
  tenantId: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  devBypass: () => void;
}

export const DEV_MOCK_USER: AuthUser = {
  id: 'dev-00000000-0000-0000-0000-000000000001',
  supabaseId: 'dev-00000000-0000-0000-0000-000000000001',
  email: 'owner@demo.onemdr.com',
  firstName: 'Alice',
  lastName: 'Owner',
  role: 'OWNER',
  tenantId: 'dev-00000000-0000-0000-0000-000000000000',
  mfaEnabled: false,
};

const DEV_BYPASS_ENABLED =
  process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

/** Map a Supabase User to our AuthUser shape. */
export function mapSupabaseSession(user: SupabaseUser): AuthUser {
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    id: (appMeta['user_id'] as string) ?? user.id,
    supabaseId: user.id,
    email: user.email ?? '',
    firstName: (userMeta['first_name'] as string) ?? '',
    lastName: (userMeta['last_name'] as string) ?? '',
    role: ((appMeta['app_role'] as string) ?? 'MEMBER') as AuthUser['role'],
    tenantId: (appMeta['tenant_id'] as string) ?? '',
    avatarUrl: (userMeta['avatar_url'] as string) ?? undefined,
    mfaEnabled: false,
  };
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,

  setSession: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, isLoading: false }),

  clearSession: () => {
    // Clear dev bypass cookie in case it was set
    if (typeof document !== 'undefined') {
      document.cookie = 'dev_session=; path=/; max-age=0';
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw new Error(error.message);
      if (!data.session || !data.user) throw new Error('Login failed. Please try again.');

      // Enforce email verification — Supabase invite flow verifies automatically.
      // For direct signups, require the user to verify before accessing the app.
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error(
          'Please verify your email address before signing in. Check your inbox for an invite or verification link.',
        );
      }

      const user = mapSupabaseSession(data.user);

      // Guard: user must have a provisioned tenant (set via app_metadata by Railway on approval)
      if (!user.tenantId) {
        await supabase.auth.signOut();
        throw new Error(
          'Your account has not been provisioned yet. Please contact your administrator.',
        );
      }

      set({ user, accessToken: data.session.access_token, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, accessToken: null, isAuthenticated: false });
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
}));

// Convenience selectors
export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useAccessToken = () => useAuthStore((s) => s.accessToken);
