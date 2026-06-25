'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import {
  ChevronLeft,
  Building2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCurrentUser } from '@/store/auth.store';
import { getTenant, updateTenant, type TenantInfo } from '@/lib/auth.api';
import { cn } from '@/lib/utils';

const PLAN_BADGE: Record<string, string> = {
  FREE: 'text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10',
  PRO: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/25',
  ENTERPRISE:
    'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/25',
};

export default function WorkspacePage() {
  const currentUser = useCurrentUser();
  const canEdit = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getTenant()
      .then((t) => {
        setTenant(t);
        setName(t.name);
        setMfaEnforced(t.mfaEnforced);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load workspace'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await updateTenant({ name: name.trim(), mfaEnforced });
      setSaved(true);
      if (tenant) setTenant({ ...tenant, name: name.trim(), mfaEnforced });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save workspace settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Workspace Settings" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
          </Link>

          {loadError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400 dark:text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading workspace…</span>
            </div>
          ) : tenant ? (
            <>
              {/* Tenant info */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">General</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                        PLAN_BADGE[tenant.plan] ?? PLAN_BADGE.FREE,
                      )}
                    >
                      {tenant.plan}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {tenant.tenantType}
                    </span>
                  </div>
                </div>

                {saved && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4 shrink-0" /> Workspace settings saved.
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {saveError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    Workspace name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. Acme Security Team"
                    className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60 disabled:cursor-default"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    Workspace slug
                  </label>
                  <input
                    type="text"
                    value={tenant.slug}
                    readOnly
                    className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3.5 py-2.5 text-sm font-mono text-slate-500 dark:text-zinc-400 opacity-60 cursor-default"
                  />
                </div>

                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving || !name.trim()}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors shadow-sm shadow-amber-500/20"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save changes
                    </button>
                  </div>
                )}
              </div>

              {/* Usage */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Usage & limits
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 p-4 space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Team members</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {tenant._count.users}
                      <span className="ml-1 text-sm font-normal text-slate-400 dark:text-zinc-500">
                        / {tenant.maxUsers}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 p-4 space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-medium">License expires</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {tenant.licenseExpiresAt
                        ? new Date(tenant.licenseExpiresAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'No expiry'}
                    </p>
                  </div>
                </div>
                {tenant.licenseModules.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                      Active modules
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tenant.licenseModules.map((m) => (
                        <span
                          key={m}
                          className="rounded-md border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-zinc-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Security policy */}
              {canEdit && (
                <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Security policy
                  </h2>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={mfaEnforced}
                      onChange={(e) => setMfaEnforced(e.target.checked)}
                      className="mt-0.5 accent-amber-600"
                    />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
                        <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Enforce MFA for all members
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Team members will be required to enable two-factor authentication before
                        accessing the platform.
                      </p>
                    </div>
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors shadow-sm shadow-amber-500/20"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save policy
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
