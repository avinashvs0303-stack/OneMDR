'use client';

import { Header } from '@/components/layout/header';
import { useCurrentUser } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { Camera, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const user = useCurrentUser();

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

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Personal information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={user?.firstName ?? ''} />
              <Field label="Last name" value={user?.lastName ?? ''} />
            </div>
            <Field label="Email address" value={user?.email ?? ''} type="email" />
            <Field label="Job title" value="" placeholder="e.g. Security Analyst" />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                Timezone
              </label>
              <select className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
                <option>UTC+00:00 — London</option>
                <option>UTC-05:00 — New York</option>
                <option>UTC-08:00 — Los Angeles</option>
                <option>UTC+05:30 — Mumbai</option>
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
              >
                Save changes
              </button>
            </div>
          </div>

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
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
      />
    </div>
  );
}
