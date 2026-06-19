'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore, mapSupabaseSession } from '@/store/auth.store';

/**
 * Restores the Supabase session into Zustand on mount and keeps it in sync.
 *
 * On initial render (hard refresh, new tab): reads the existing Supabase cookie
 * session and populates the auth store. After that, onAuthStateChange keeps
 * the store current whenever tokens rotate or the user signs out in another tab.
 *
 * This replaces the old manual /auth/refresh polling approach. Supabase handles
 * all token rotation automatically via @supabase/ssr middleware + this listener.
 */
export function SessionRestorer() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    // Hydrate from the current session on mount (handles hard refresh / new tab)
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(mapSupabaseSession(session.user), session.access_token);
      }
    });

    // Keep store in sync with Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        setSession(mapSupabaseSession(session.user), session.access_token);
      } else if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        clearSession();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, clearSession]);

  return null;
}
