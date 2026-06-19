'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import type { AuthUser } from '@/lib/auth.api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/mfa',
  '/auth/callback',
];

/**
 * Restores a user session from the httpOnly refresh_token cookie when
 * sessionStorage is empty (e.g. after a hard refresh or new tab).
 *
 * This covers the gap between the Next.js middleware (which checks the cookie
 * and lets the user through) and the React app (which needs the access token
 * in memory to make authenticated API calls).
 */
export function SessionRestorer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const pathname = usePathname();
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    // Nothing to do on public pages or when already authenticated
    if (isPublic || isAuthenticated) return;

    // Only one restoration attempt per component lifecycle
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        // Try to get a new access token from the httpOnly refresh_token cookie
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!refreshRes.ok) {
          // Cookie missing, expired, or revoked — send to login
          clearSession();
          router.replace('/auth/login');
          return;
        }

        const refreshBody = (await refreshRes.json()) as { data: { accessToken: string } };
        const accessToken = refreshBody.data?.accessToken;
        if (!accessToken) {
          clearSession();
          router.replace('/auth/login');
          return;
        }

        // Fetch the current user profile to rebuild the store
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!meRes.ok) {
          clearSession();
          router.replace('/auth/login');
          return;
        }

        const meBody = (await meRes.json()) as { data: AuthUser };
        setSession(meBody.data, accessToken);
      } catch {
        clearSession();
        router.replace('/auth/login');
      }
    })();
  }, [isAuthenticated, pathname, setSession, clearSession, router]);

  return null;
}
