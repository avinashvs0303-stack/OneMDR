import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your OneMDR workspace</p>
      </div>

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
