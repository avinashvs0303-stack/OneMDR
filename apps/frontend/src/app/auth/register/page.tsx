import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleIcon } from '@/components/icons/google-icon';
import { MicrosoftIcon } from '@/components/icons/microsoft-icon';

export const metadata: Metadata = { title: 'Create account' };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start free — no credit card required</p>
      </div>

      <div className="space-y-6">
        {/* SSO fast-track */}
        <div className="space-y-3">
          <a
            href={`${API_BASE}/auth/google`}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent"
          >
            <GoogleIcon className="h-4 w-4" />
            Sign up with Google
          </a>
          <a
            href={`${API_BASE}/auth/microsoft`}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent"
          >
            <MicrosoftIcon className="h-4 w-4" />
            Sign up with Microsoft
          </a>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or use email</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">First name</label>
              <input type="text" placeholder="Alice" className="block w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Last name</label>
              <input type="text" placeholder="Smith" className="block w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Work email</label>
            <input type="email" placeholder="you@company.com" className="block w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Password</label>
            <input type="password" placeholder="Min. 12 characters" className="block w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          >
            Create account — wires up in Step 1
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
