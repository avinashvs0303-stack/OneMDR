'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * /auth/callback — OAuth redirect target for Google / Microsoft sign-in.
 *
 * Supabase redirects here after the OAuth provider grants access.
 * The URL contains a `code` query parameter (PKCE flow).
 * We exchange it for a session and then redirect to /modules.
 *
 * If the user's Supabase account has no `app_metadata.tenant_id`
 * (they signed in via OAuth but were never invited), we show an error.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        const appMeta = data.session.user.app_metadata ?? {};
        if (!appMeta['tenant_id']) {
          await supabase.auth.signOut();
          setError(
            'Your account has not been provisioned. Please request access and wait for approval, then use the invite link from your email.',
          );
          return;
        }
        router.replace('/modules');
      } else {
        // No session yet — might need a moment for Supabase to process the code
        setTimeout(() => router.replace('/auth/login'), 2000);
      }
    })();
  }, [router]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
        <a
          href="/auth/login"
          className="text-sm text-amber-600 hover:underline dark:text-amber-400"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      <p className="text-sm text-muted-foreground">Completing sign in…</p>
    </div>
  );
}
