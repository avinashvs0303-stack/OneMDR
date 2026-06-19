'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const schema = z.object({
  companyName: z.string().min(2, 'Required').max(100),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']),
  industry: z.string().min(2, 'Required').max(100),
  contactName: z.string().min(2, 'Required').max(100),
  contactEmail: z.string().email('Enter a valid email address'),
  contactPhone: z.string().optional(),
  useCase: z.string().min(20, 'Please describe your use case (min 20 characters)').max(1000),
});

type FormValues = z.infer<typeof schema>;

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

export default function RequestAccessPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch('/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Submission failed. Please try again.');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setServerError(msg);
    }
  };

  if (submitted) {
    return (
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Application received
          </h1>
          <p className="text-sm text-muted-foreground">
            Thank you for your interest in OneMDR. Our team will review your application and contact
            you at the email you provided within 1–2 business days.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-medium text-amber-600 hover:underline underline-offset-4 dark:text-amber-400"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Request access</h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your organisation and use case. We review every application manually.
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

        {/* Company */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
            Company
          </p>

          <Field label="Company name" error={errors.companyName?.message}>
            <input
              type="text"
              placeholder="Acme Security Ltd"
              {...register('companyName')}
              className={inputCls(!!errors.companyName)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Team size" error={errors.companySize?.message}>
              <select {...register('companySize')} className={inputCls(!!errors.companySize)}>
                <option value="">Select…</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} employees
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Industry" error={errors.industry?.message}>
              <input
                type="text"
                placeholder="Financial Services"
                {...register('industry')}
                className={inputCls(!!errors.industry)}
              />
            </Field>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
            Your contact details
          </p>

          <Field label="Full name" error={errors.contactName?.message}>
            <input
              type="text"
              placeholder="Alice Smith"
              autoComplete="name"
              {...register('contactName')}
              className={inputCls(!!errors.contactName)}
            />
          </Field>

          <Field label="Work email" error={errors.contactEmail?.message}>
            <input
              type="email"
              placeholder="alice@acme.com"
              autoComplete="email"
              {...register('contactEmail')}
              className={inputCls(!!errors.contactEmail)}
            />
          </Field>

          <Field label="Phone (optional)" error={errors.contactPhone?.message}>
            <input
              type="tel"
              placeholder="+1 555 0100"
              autoComplete="tel"
              {...register('contactPhone')}
              className={inputCls(false)}
            />
          </Field>
        </div>

        {/* Use case */}
        <Field
          label="How will you use OneMDR?"
          error={errors.useCase?.message}
          hint="Describe your security environment, current tooling, and what you want to achieve."
        >
          <textarea
            rows={4}
            placeholder="We're a SOC team of 5 analysts covering…"
            {...register('useCase')}
            className={cn(inputCls(!!errors.useCase), 'resize-none')}
          />
        </Field>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all',
            'bg-amber-600 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit application'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="font-medium text-amber-600 hover:underline underline-offset-4 dark:text-amber-400"
        >
          Sign in
        </Link>
      </p>
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

function inputCls(hasError: boolean) {
  return cn(
    'block w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60',
    'shadow-sm outline-none transition-all focus:ring-2',
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
      : 'border-border focus:border-amber-500 focus:ring-amber-500/20',
  );
}
