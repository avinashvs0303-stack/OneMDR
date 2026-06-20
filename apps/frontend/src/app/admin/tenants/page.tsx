'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Building2, Users, ChevronRight, Loader2, Key, AlertTriangle } from 'lucide-react';
import { adminApi, type TenantSummary, type TenantPlan } from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const PLAN_COLORS: Record<TenantPlan, string> = {
  FREE: 'bg-slate-500/20 text-slate-400',
  PRO: 'bg-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400',
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400_000);
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(
        await adminApi.listTenants({
          search: search || undefined,
          plan: plan || undefined,
          status: status || undefined,
        }),
      );
    } catch {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [search, plan, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Tenants</h1>
        <p className="text-sm text-slate-400 mt-0.5">All provisioned customer organisations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slugâ€¦"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-600/40 focus:outline-none focus:ring-1 focus:ring-blue-600/20 sm:w-56"
          />
        </div>

        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600/20"
        >
          <option value="">All plans</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600/20"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        <p className="sm:ml-auto text-xs text-slate-500">
          {loading ? 'â€¦' : `${tenants.length} result${tenants.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <Building2 className="h-12 w-12 opacity-30" />
          <p className="text-sm">No tenants found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black tracking-widest uppercase text-slate-500">
                {['Organisation', 'Plan', 'Users', 'Modules', 'License expires', 'Status', ''].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t) => {
                const expiresIn = t.licenseExpiresAt ? daysUntil(t.licenseExpiresAt) : null;
                const expiringSoon = expiresIn !== null && expiresIn <= 30;

                return (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            t.isActive ? 'bg-emerald-400' : 'bg-slate-500',
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.slug}</p>
                        </div>
                      </div>
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
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Users className="h-3 w-3 text-slate-500" />
                        {t._count.users}
                        <span className="text-slate-600">/ {t.maxUsers}</span>
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
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                            +{t.licenseModules.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.licenseExpiresAt ? (
                        <span
                          className={cn(
                            'flex items-center gap-1 text-xs',
                            expiringSoon ? 'text-amber-400' : 'text-slate-400',
                          )}
                        >
                          {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                          {new Date(t.licenseExpiresAt).toLocaleDateString()}
                          {expiringSoon && <span className="text-[10px]">({expiresIn}d)</span>}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Key className="h-3 w-3" /> No expiry
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          t.isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400',
                        )}
                      >
                        {t.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-blue-600/30 hover:text-blue-400 transition-all"
                      >
                        Manage <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
