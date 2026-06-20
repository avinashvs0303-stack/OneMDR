'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * /auth/set-password — landed from the Supabase invite email.
 *
 * Supabase (PKCE flow) appends ?token_hash=xxx&type=invite to the redirectTo URL.
 * We must call verifyOtp() to exchange that token for a real session before
 * letting the user set their password.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Subscribe to auth events first so we don't miss them
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;

    if (tokenHash && type) {
      // PKCE: exchange the one-time token for a real session
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (error) {
          setLinkError(
            'This invite link has expired or has already been used. Please ask your administrator to resend the invite.',
          );
        }
        // On success, onAuthStateChange fires SIGNED_IN → setReady(true)
      });
    } else {
      // No token in URL — check for an existing valid session
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
        // If there's no session and no token, the link is broken
        else {
          setLinkError(
            'Invalid or missing invite link. Please use the link from your invitation email.',
          );
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push('/modules');
  };

  if (linkError) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Link expired</h2>
          <p className="mt-1 text-sm text-muted-foreground">{linkError}</p>
        </div>
        <a
          href="/auth/login"
          className="inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Verifying your invite link…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Create your password</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Set a secure password to complete your account setup.
          </p>
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

        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          showPassword={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          registration={register('password')}
          error={errors.password?.message}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          showPassword={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
          registration={register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />

        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• At least 8 characters</li>
          <li>• At least one uppercase letter</li>
          <li>• At least one number</li>
        </ul>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Set password & continue
        </button>
      </form>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: string;
  showPassword: boolean;
  onToggle: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registration: any;
  error?: string;
}

function PasswordField({
  id,
  label,
  autoComplete,
  showPassword,
  onToggle,
  registration,
  error,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="••••••••"
          {...registration}
          className={cn(
            'block w-full rounded-lg border bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60',
            'shadow-sm outline-none transition-all focus:ring-2',
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
              : 'border-border focus:border-amber-500 focus:ring-amber-500/20',
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
