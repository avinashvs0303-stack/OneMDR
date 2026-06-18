'use client';

import { Header } from '@/components/layout/header';
import { Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const TENANTS = [
  {
    id: 'T-001',
    name: 'Demo Corp',
    plan: 'Pro',
    status: 'active',
    analysts: 9,
    detectionsPack: 12,
    siems: ['Splunk', 'Sentinel'],
    coverage: 63,
    alertsToday: 47,
    fpRate: 8.2,
    joinedAt: 'Jan 2026',
  },
  {
    id: 'T-002',
    name: 'Meridian Labs',
    plan: 'Enterprise',
    status: 'active',
    analysts: 24,
    detectionsPack: 18,
    siems: ['Splunk', 'Chronicle', 'QRadar'],
    coverage: 71,
    alertsToday: 112,
    fpRate: 6.4,
    joinedAt: 'Nov 2025',
  },
  {
    id: 'T-003',
    name: 'Apex Financial',
    plan: 'Enterprise',
    status: 'active',
    analysts: 31,
    detectionsPack: 22,
    siems: ['Sentinel', 'Splunk', 'Elastic'],
    coverage: 78,
    alertsToday: 89,
    fpRate: 5.1,
    joinedAt: 'Sep 2025',
  },
  {
    id: 'T-004',
    name: 'Nova Healthcare',
    plan: 'Pro',
    status: 'onboarding',
    analysts: 6,
    detectionsPack: 8,
    siems: ['Splunk'],
    coverage: 44,
    alertsToday: 18,
    fpRate: 14.3,
    joinedAt: 'Jun 2026',
  },
  {
    id: 'T-005',
    name: 'Stargate Retail',
    plan: 'Starter',
    status: 'active',
    analysts: 3,
    detectionsPack: 5,
    siems: ['Elastic'],
    coverage: 31,
    alertsToday: 9,
    fpRate: 17.8,
    joinedAt: 'Apr 2026',
  },
];

const STATUS_BADGE: Record<string, string> = {
  active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border border-emerald-500/30',
  onboarding: 'text-amber-600 dark:text-amber-400 bg-amber-500/20 border border-amber-500/25',
  churned: 'text-red-600 dark:text-red-400 bg-red-500/15 border border-red-500/25',
};

const PLAN_BADGE: Record<string, string> = {
  Enterprise: 'text-amber-600 dark:text-amber-400 bg-amber-500/20 border border-amber-500/25',
  Pro: 'text-violet-600 dark:text-violet-400 bg-violet-500/20 border border-violet-500/25',
  Starter:
    'text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10',
};

export default function TenantsPage() {
  const totalAlerts = TENANTS.reduce((s, t) => s + t.alertsToday, 0);
  const avgCoverage = Math.round(TENANTS.reduce((s, t) => s + t.coverage, 0) / TENANTS.length);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Multi-Tenant Operators" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Total tenants',
              value: String(TENANTS.length),
              color: 'text-slate-900 dark:text-white',
            },
            {
              label: 'Avg ATT&CK coverage',
              value: `${avgCoverage}%`,
              color: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              label: 'Total alerts today',
              value: String(totalAlerts),
              color: 'text-slate-900 dark:text-white',
            },
            {
              label: 'Onboarding',
              value: String(TENANTS.filter((t) => t.status === 'onboarding').length),
              color: 'text-amber-600 dark:text-amber-400',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg"
            >
              <p className="text-xs text-slate-400 dark:text-zinc-500">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
            All tenants
          </h2>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> Provision tenant
          </button>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20">
                {[
                  'Tenant',
                  'Plan',
                  'Status',
                  'Coverage',
                  'Detections',
                  'SIEMs',
                  'Alerts Today',
                  'FP Rate',
                  '',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-zinc-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {TENANTS.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-600 text-xs font-bold text-white">
                        {tenant.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-xs">
                          {tenant.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">{tenant.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-[11px] font-semibold',
                        PLAN_BADGE[tenant.plan],
                      )}
                    >
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize',
                        STATUS_BADGE[tenant.status],
                      )}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            tenant.coverage >= 70
                              ? 'bg-emerald-500'
                              : tenant.coverage >= 50
                                ? 'bg-amber-400'
                                : 'bg-red-500',
                          )}
                          style={{ width: `${tenant.coverage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-900 dark:text-white">
                        {tenant.coverage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-zinc-300">
                    {tenant.detectionsPack}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5 flex-wrap">
                      {tenant.siems.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-1.5 py-0.5 text-[9px] text-slate-500 dark:text-zinc-400"
                        >
                          {s === 'Microsoft Sentinel' ? 'Sentinel' : s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-zinc-300">
                    {tenant.alertsToday}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={cn(
                        'font-medium',
                        tenant.fpRate > 12
                          ? 'text-red-500 dark:text-red-400'
                          : tenant.fpRate > 7
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {tenant.fpRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-300 dark:text-zinc-600 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
