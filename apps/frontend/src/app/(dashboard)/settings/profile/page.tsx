'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { useCurrentUser } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { Camera, ChevronLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { updateProfile } from '@/lib/auth.api';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC+00:00 — London / UTC' },
  { value: 'America/New_York', label: 'UTC-05:00 — New York' },
  { value: 'America/Chicago', label: 'UTC-06:00 — Chicago' },
  { value: 'America/Denver', label: 'UTC-07:00 — Denver' },
  { value: 'America/Los_Angeles', label: 'UTC-08:00 — Los Angeles' },
  { value: 'Europe/Paris', label: 'UTC+01:00 — Paris / Berlin' },
  { value: 'Europe/Helsinki', label: 'UTC+02:00 — Helsinki / Kyiv' },
  { value: 'Asia/Dubai', label: 'UTC+04:00 — Dubai' },
  { value: 'Asia/Kolkata', label: 'UTC+05:30 — Mumbai / Delhi' },
  { value: 'Asia/Singapore', label: 'UTC+08:00 — Singapore / KL' },
  { value: 'Asia/Tokyo', label: 'UTC+09:00 — Tokyo' },
  { value: 'Australia/Sydney', label: 'UTC+10:00 — Sydney' },
];

export default function ProfilePage() {
  const user = useCurrentUser();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Profile" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
          </Link>

          {/* Avatar */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Profile photo</h2>
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-600 text-xl font-bold text-white shadow-lg shadow-amber-500/20">
                  {user ? getInitials(user.firstName, user.lastName) : 'U'}
                </div>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 bg-amber-600 text-white hover:bg-amber-500 transition-colors"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  className="block rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  Upload photo
                </button>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  JPG or PNG. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Personal information
            </h2>

            {saved && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Changes saved successfully.
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
            </div>
            <Field label="Email address" value={user?.email ?? ''} type="email" readOnly />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors shadow-sm shadow-amber-500/20"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/10 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
            <p className="text-xs text-red-600/80 dark:text-red-400/70">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button
              type="button"
              className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  type = 'text',
  placeholder,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 read-only:opacity-60 read-only:cursor-default"
      />
    </div>
  );
}
