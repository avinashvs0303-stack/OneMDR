'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { verifyMfaLogin } from '@/lib/auth.api';

const schema = z.object({
  code: z
    .string()
    .length(6, 'Enter the 6-digit code from your authenticator app')
    .regex(/^\d+$/, 'Code must contain only digits'),
});
type FormValues = z.infer<typeof schema>;

function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);

  const mfaToken = searchParams.get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!mfaToken) router.replace('/auth/login');
  }, [mfaToken, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const session = await verifyMfaLogin({ mfaToken, code: data.code });
      setSession(session.user, session.accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setServerError(msg);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
          <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Two-factor verification
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
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

        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium text-foreground">
            Authenticator code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            {...register('code')}
            className={cn(
              'block w-full rounded-lg border bg-background px-3.5 py-3 text-center text-2xl font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40',
              'shadow-sm outline-none transition-all focus:ring-2',
              errors.code
                ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                : 'border-border focus:border-indigo-500 focus:ring-indigo-500/20',
            )}
          />
          {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white',
            'bg-indigo-600 hover:bg-indigo-500 transition-all',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Can&apos;t access your authenticator?{' '}
        <span className="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline underline-offset-4">
          Use a backup code
        </span>
      </p>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}
