'use client';

import { Header } from '@/components/layout/header';
import { ChevronLeft, Key, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '@/store/auth.store';

export default function ApiPage() {
  const user = useCurrentUser();

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="API & Integrations" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
          </Link>

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/20 px-5 py-4 text-sm text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">API Keys coming soon</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/70">
                Programmatic API access and webhook management are being built. For SIEM
                integrations, use the{' '}
                <Link href="/integrations" className="underline hover:no-underline">
                  Integrations
                </Link>{' '}
                page to connect your existing tools.
              </p>
            </div>
          </div>

          {/* Account info */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-500 dark:text-zinc-400">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Your API identity
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Use these values when integrating with external tools.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <InfoRow label="User ID" value={user?.id ?? '—'} mono />
              <InfoRow label="Tenant ID" value={user?.tenantId ?? '—'} mono />
              <InfoRow label="Role" value={user?.role ?? '—'} />
              <InfoRow label="Email" value={user?.email ?? '—'} />
            </div>
          </div>

          {/* Integrations link */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              SIEM Integrations
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Connect Splunk, Microsoft Sentinel, Chronicle, Elastic, QRadar, and more to deploy
              detections directly from the platform.
            </p>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
            >
              Manage integrations <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 px-4 py-2.5">
      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-slate-900 dark:text-white truncate ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
