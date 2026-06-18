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
  const loginFn = useAuthStore((s) => s.login);
  const devBypass = useAuthStore((s) => s.devBypass);

  const [showPassword, setShowPassword] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'google' | 'microsoft' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const handleDevBypass = () => {
    devBypass();
    router.push('/modules');
  };

  const handleSSO = (provider: 'google' | 'microsoft') => {
    setSsoLoading(provider);
    window.location.href = `${API_BASE}/auth/${provider}`;
  };

  const onSubmit = async (data: LoginValues) => {
    setServerError(null);
    try {
      const result = await loginFn(data.email, data.password, data.rememberMe);

      if (result.requiresMfa) {
        // Redirect to MFA verification page with the short-lived challenge token
        router.push(`/auth/mfa?token=${encodeURIComponent(result.mfaToken)}`);
        return;
      }

      router.push('/modules');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setServerError(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Dev bypass banner (local only) ─────────────────────────────── */}
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
      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        noValidate
        className="space-y-4"
      >
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
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
              'shadow-sm outline-none transition-all focus:ring-2',
              errors.email
                ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                : 'border-border focus:border-amber-500 focus:ring-amber-500/20',
            )}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-amber-600 hover:underline underline-offset-4 dark:text-amber-400"
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
                'shadow-sm outline-none transition-all focus:ring-2',
                errors.password
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                  : 'border-border focus:border-amber-500 focus:ring-amber-500/20',
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
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="rememberMe"
            type="checkbox"
            {...register('rememberMe')}
            className="h-4 w-4 rounded border-border accent-amber-600"
          />
          <label htmlFor="rememberMe" className="text-sm text-muted-foreground select-none">
            Keep me signed in for 30 days
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || ssoLoading !== null}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all',
            'bg-amber-600 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600',
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
    </div>
  );
}

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
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : icon}
      {label}
    </button>
  );
}
