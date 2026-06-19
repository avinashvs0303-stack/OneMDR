'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';

/**
 * /auth/verify-email — shown after self-registration.
 * For invite-only onboarding, this page is not part of the main flow
 * (invites are pre-verified). It exists as a fallback for future direct signups.
 */
export default function VerifyEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Mail className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Verify your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We've sent you a verification link. Click the link in your email to activate your account.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Didn't receive it? Check your spam folder. The link expires in 24 hours.
      </p>
      <Link
        href="/auth/login"
        className="inline-block text-sm font-medium text-amber-600 hover:underline underline-offset-4 dark:text-amber-400"
      >
        Back to sign in
      </Link>
    </div>
  );
}
