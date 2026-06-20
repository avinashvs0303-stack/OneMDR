'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  AlertTriangle,
  Building2,
  Key,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { adminApi, type AdminOverview } from '@/lib/admin.api';
import { cn } from '@/lib/utils';

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi.getOverview());
    } catch {
      setError('Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">Platform health and pending actions</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label="New Leads"
          value={String(data.requests.pending)}
          sub={
            data.requests.overdue > 0
              ? `${data.requests.overdue} unreviewed (>7 days)`
              : 'All reviewed'
          }
          subColor={data.requests.overdue > 0 ? 'text-red-400' : 'text-emerald-400'}
          icon={Clock}
          iconColor="text-blue-400"
          accent="border-blue-600/20 bg-blue-600/5"
          href="/admin/leads"
        />
        <KpiCard
          label="Active Tenants"
          value={String(data.tenants.active)}
          sub={
            data.tenants.suspended > 0
              ? `${data.tenants.suspended} suspended`
              : `${data.tenants.total} total`
          }
          subColor={data.tenants.suspended > 0 ? 'text-red-400' : 'text-slate-400'}
          icon={Building2}
          iconColor="text-violet-400"
          accent="border-violet-500/20 bg-violet-500/5"
          href="/admin/tenants"
        />
        <KpiCard
          label="Expiring (30d)"
          value={String(data.licenses.expiring30)}
          sub={`${data.licenses.expiring60} in 60d · ${data.licenses.expiring90} in 90d`}
          subColor={data.licenses.expiring30 > 0 ? 'text-amber-400' : 'text-slate-400'}
          icon={Key}
          iconColor="text-sky-400"
          accent="border-sky-500/20 bg-sky-500/5"
          href="/admin/licenses"
        />
        <KpiCard
          label="Total Tenants"
          value={String(data.tenants.total)}
          sub="All time provisioned"
          subColor="text-slate-400"
          icon={TrendingUp}
          iconColor="text-emerald-400"
          accent="border-emerald-500/20 bg-emerald-500/5"
          href="/admin/tenants"
        />
      </div>

      {/* Two-column: recent requests + recent tenants */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending requests */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">New Leads</h2>
            <Link
              href="/admin/leads"
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No pending requests</p>
          ) : (
            <ul className="space-y-2">
              {data.recentRequests.map((req) => {
                const days = Math.floor(
                  (Date.now() - new Date(req.createdAt).getTime()) / 86400_000,
                );
                const overdue = days > 7;
                return (
                  <li key={req.id}>
                    <Link
                      href={`/admin/leads?id=${req.id}`}
                      className="flex items-start justify-between rounded-lg border border-white/5 bg-white/5 px-3.5 py-2.5 hover:bg-white/10 transition-colors gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.companyName}</p>
                        <p className="text-xs text-slate-400 truncate">{req.contactEmail}</p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          overdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400',
                        )}
                      >
                        {days === 0 ? 'today' : `${days}d`}
                        {overdue && ' ⚠'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent tenants */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Tenants</h2>
            <Link
              href="/admin/tenants"
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentTenants.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No tenants yet</p>
          ) : (
            <ul className="space-y-2">
              {data.recentTenants.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/tenants/${t.id}`}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3.5 py-2.5 hover:bg-white/10 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-2 w-2 shrink-0 rounded-full',
                          t.isActive ? 'bg-emerald-400' : 'bg-slate-500',
                        )}
                      />
                      <span className="text-sm font-medium text-white truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PlanBadge plan={t.plan} />
                      <span className="text-xs text-slate-500">{daysAgo(t.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Overdue alert */}
      {data.requests.overdue > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3.5">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-red-300">
              {data.requests.overdue} lead{data.requests.overdue > 1 ? 's' : ''} unreviewed
            </span>
            <span className="text-red-400/80"> — waiting more than 7 days. </span>
            <Link href="/admin/leads" className="font-medium text-red-300 hover:underline">
              Review now →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  subColor,
  icon: Icon,
  iconColor,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  subColor: string;
  icon: React.ElementType;
  iconColor: string;
  accent: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn('group rounded-xl border p-5 transition-all hover:brightness-110', accent)}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      <p className={cn('mt-1 text-xs', subColor)}>{sub}</p>
    </Link>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    FREE: 'bg-slate-500/20 text-slate-400',
    PRO: 'bg-violet-500/20 text-violet-400',
    ENTERPRISE: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        colors[plan] ?? colors['FREE'],
      )}
    >
      {plan}
    </span>
  );
}
