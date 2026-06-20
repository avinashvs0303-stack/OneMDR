import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

const ERROR_MESSAGES: Record<string, string> = {
  not_provisioned:
    'Your account has not been provisioned with a workspace. Please use the invite link from your welcome email, or contact your administrator.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorKey = typeof params['error'] === 'string' ? params['error'] : null;
  const errorMsg = errorKey ? (ERROR_MESSAGES[errorKey] ?? null) : null;

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your OneMDR workspace</p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
        >
          {errorMsg}
        </div>
      )}

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        Interested in OneMDR?{' '}
        <Link
          href="/request-access"
          className="font-medium text-amber-600 underline-offset-4 hover:underline dark:text-amber-400"
        >
          Request access →
        </Link>
      </p>
    </div>
  );
}
