'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a password reset link to{' '}
            <span className="font-medium text-foreground">{getValues('email')}</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn't receive it? Check your spam folder or{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-blue-600 hover:underline underline-offset-4 dark:text-blue-400"
          >
            try again
          </button>
        </p>
        <Link
          href="/auth/login"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Forgot your password?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email address and we'll send you a reset link.
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
                : 'border-border focus:border-blue-600 focus:ring-blue-600/20',
            )}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send reset link
        </button>
      </form>

      <Link
        href="/auth/login"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
