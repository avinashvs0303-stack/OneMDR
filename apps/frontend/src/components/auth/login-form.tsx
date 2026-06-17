'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Zap } from 'lucide-react';
import { GoogleIcon } from '@/components/icons/google-icon';
import { MicrosoftIcon } from '@/components/icons/microsoft-icon';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
const DEV_BYPASS = process.env['NEXT_PUBLIC_DEV_BYPASS_AUTH'] === 'true';

export function LoginForm() {
  const router = useRouter();
  const devBypass = useAuthStore((s) => s.devBypass);
  const [showPassword, setShowPassword] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'google' | 'microsoft' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleDevBypass = () => {
    devBypass();
    router.push('/dashboard');
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // SSO — redirect to backend OAuth flow
  const handleSSO = (provider: 'google' | 'microsoft') => {
    setSsoLoading(provider);
    // Backend OAuth routes wired up in Step 1
    window.location.href = `${API_BASE}/auth/${provider}`;
  };

  const onSubmit = async (data: LoginValues) => {
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setServerError(body.error?.message ?? 'Login failed. Please try again.');
        return;
      }

      // Step 1 will handle: store access token, redirect to /dashboard
      window.location.href = '/dashboard';
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Dev bypass banner (local only) ───────────────────────────── */}
      {DEV_BYPASS && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800/40 dark:bg-violet-950/30">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            Local dev mode
          </p>
          <button
            type="button"
            onClick={handleDevBypass}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-500 active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" />
            Skip login — enter as Demo Owner
          </button>
          <p className="mt-2 text-center text-[11px] text-violet-500/70">
            Not visible in production
          </p>
        </div>
      )}

      {/* ── SSO Buttons ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SSOButton
          onClick={() => handleSSO('google')}
          loading={ssoLoading === 'google'}
          disabled={ssoLoading !== null || isSubmitting}
          icon={<GoogleIcon className="h-4 w-4" />}
          label="Continue with Google"
        />
        <SSOButton
          onClick={() => handleSSO('microsoft')}
          loading={ssoLoading === 'microsoft'}
          disabled={ssoLoading !== null || isSubmitting}
          icon={<MicrosoftIcon className="h-4 w-4" />}
          label="Continue with Microsoft"
        />
      </div>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">or continue with email</span>
        </div>
      </div>

      {/* ── Email / Password Form ─────────────────────────────────────── */}
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate className="space-y-4">
        {/* Server-level error */}
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className={cn(
              'block w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60',
              'shadow-sm outline-none ring-0 transition-all',
              'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
              errors.email
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : 'border-border',
            )}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-indigo-600 hover:underline underline-offset-4 dark:text-indigo-400"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'block w-full rounded-lg border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60',
                'shadow-sm outline-none ring-0 transition-all',
                'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                errors.password
                  ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                  : 'border-border',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="rememberMe"
            type="checkbox"
            {...register('rememberMe')}
            className="h-4 w-4 rounded border-border accent-indigo-600"
          />
          <label htmlFor="rememberMe" className="text-sm text-muted-foreground select-none">
            Keep me signed in for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || ssoLoading !== null}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all',
            'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {!DEV_BYPASS && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
          Auth backend wires up in Step 1 — SSO + JWT + MFA
        </p>
      )}
    </div>
  );
}

// ── Reusable SSO button ────────────────────────────────────────────────────────

interface SSOButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}

function SSOButton({ onClick, loading, disabled, icon, label }: SSOButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5',
        'text-sm font-medium text-foreground shadow-sm transition-all',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
