'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Key, AlertTriangle, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { adminApi, type ExpiringLicense, type TenantPlan } from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const PLAN_COLORS: Record<TenantPlan, string> = {
  FREE: 'bg-slate-500/20 text-slate-400',
  PRO: 'bg-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400',
};

type Window = 30 | 60 | 90;

const WINDOWS: { days: Window; label: string; urgency: string }[] = [
  { days: 30, label: 'Expiring within 30 days', urgency: 'Critical' },
  { days: 60, label: 'Expiring within 60 days', urgency: 'Warning' },
  { days: 90, label: 'Expiring within 90 days', urgency: 'Watch' },
];

const URGENCY_COLORS: Record<string, string> = {
  Critical: 'border-red-500/20 bg-red-500/5 text-red-400',
  Warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  Watch: 'border-sky-500/20 bg-sky-500/5 text-sky-400',
};

export default function LicensesPage() {
  const [byWindow, setByWindow] = useState<Record<Window, ExpiringLicense[]>>({
    30: [],
    60: [],
    90: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w30, w60, w90] = await Promise.all([
        adminApi.getExpiringLicenses(30),
        adminApi.getExpiringLicenses(60),
        adminApi.getExpiringLicenses(90),
      ]);
      setByWindow({ 30: w30, 60: w60, 90: w90 });
    } catch {
      setError('Failed to load license data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const total90 = byWindow[90].length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Licenses</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {total90 > 0
              ? `${total90} license${total90 !== 1 ? 's' : ''} expiring within 90 days`
              : 'No licenses expiring in the next 90 days'}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {WINDOWS.map(({ days, label, urgency }) => {
          const count = byWindow[days].length;
          return (
            <div
              key={days}
              className={cn(
                'rounded-xl border p-4 text-center',
                count > 0 ? URGENCY_COLORS[urgency] : 'border-white/5 bg-white/5 text-slate-500',
              )}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">{label}</p>
            </div>
          );
        })}
      </div>

      {total90 === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-slate-500">
          <Key className="h-14 w-14 opacity-20" />
          <p className="text-sm">All licenses are healthy for the next 90 days</p>
        </div>
      )}

      {/* Per-window tables */}
      {WINDOWS.map(({ days, label, urgency }) => {
        const list = byWindow[days];
        if (list.length === 0) return null;

        const headerColor =
          urgency === 'Critical'
            ? 'text-red-400'
            : urgency === 'Warning'
              ? 'text-amber-400'
              : 'text-sky-400';

        return (
          <div key={days} className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-4 w-4', headerColor)} />
              <h2 className={cn('text-sm font-semibold', headerColor)}>
                {label} ({list.length})
              </h2>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black tracking-widest uppercase text-slate-500">
                    {['Organisation', 'Plan', 'Expires', 'Days left', 'Modules', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list.map((t) => {
                    const expiresDate = new Date(t.licenseExpiresAt!);
                    const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / 86400_000);
                    const urgent = daysLeft <= 30;

                    return (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.slug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                              PLAN_COLORS[t.plan],
                            )}
                          >
                            {t.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">
                          {expiresDate.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-bold',
                              urgent ? 'text-red-400' : 'text-amber-400',
                            )}
                          >
                            {daysLeft}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {t.licenseModules.slice(0, 3).map((m) => (
                              <span
                                key={m}
                                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                              >
                                {m}
                              </span>
                            ))}
                            {t.licenseModules.length > 3 && (
                              <span className="text-[10px] text-slate-500">
                                +{t.licenseModules.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/tenants/${t.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-blue-600/30 hover:text-blue-400 transition-all"
                          >
                            Renew <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
