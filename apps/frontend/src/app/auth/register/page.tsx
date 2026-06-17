'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { GoogleIcon } from '@/components/icons/google-icon';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  firstName: z.string().min(1, 'Required').max(50),
  lastName: z.string().min(1, 'Required').max(50),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(12, 'Minimum 12 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[^A-Za-z0-9]/, 'Needs a special character'),
  tenantName: z.string().min(2, 'Minimum 2 characters').max(100),
});

type FormValues = z.infer<typeof schema>;

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export default function RegisterPage() {
  const router = useRouter();
  const registerFn = useAuthStore((s) => s.register);
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await registerFn(data);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setServerError(msg);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start free — no credit card required</p>
      </div>

      <div className="space-y-6">
        {/* SSO */}
        <a
          href={`${API_BASE}/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent"
        >
          <GoogleIcon className="h-4 w-4" />
          Sign up with Google
        </a>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or use email</span>
          </div>
        </div>

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

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={errors.firstName?.message}>
              <input
                type="text"
                placeholder="Alice"
                autoComplete="given-name"
                {...register('firstName')}
                className={inputCls(!!errors.firstName)}
              />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <input
                type="text"
                placeholder="Smith"
                autoComplete="family-name"
                {...register('lastName')}
                className={inputCls(!!errors.lastName)}
              />
            </Field>
          </div>

          {/* Organisation */}
          <Field label="Organisation name" error={errors.tenantName?.message}>
            <input
              type="text"
              placeholder="Acme Corp"
              autoComplete="organization"
              {...register('tenantName')}
              className={inputCls(!!errors.tenantName)}
            />
          </Field>

          {/* Email */}
          <Field label="Work email" error={errors.email?.message}>
            <input
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              {...register('email')}
              className={inputCls(!!errors.email)}
            />
          </Field>

          {/* Password */}
          <Field
            label="Password"
            error={errors.password?.message}
            hint="Min. 12 chars · uppercase · lowercase · number · special character"
          >
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••••••"
                autoComplete="new-password"
                {...register('password')}
                className={inputCls(!!errors.password, 'pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all',
              'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our{' '}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean, extra = '') {
  return cn(
    'block w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60',
    'shadow-sm outline-none transition-all focus:ring-2',
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
      : 'border-border focus:border-indigo-500 focus:ring-indigo-500/20',
    extra,
  );
}
