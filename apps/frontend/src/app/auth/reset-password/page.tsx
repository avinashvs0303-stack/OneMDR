'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Supabase sets the session from the URL hash on RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push('/auth/login?reset=true');
  };

  if (!ready) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Set new password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
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
          label="New password"
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Update password
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
