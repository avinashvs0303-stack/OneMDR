'use client';

import { useCurrentUser } from '@/store/auth.store';
import { Header } from '@/components/layout/header';
import {
  ShieldCheck,
  Target,
  AlertTriangle,
  Clock,
  Database,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ATTACK_MATRIX, getMatrixStats } from '@/data/attack-matrix';
import { DETECTIONS, SEVERITY_COLORS, STATUS_COLORS, SIEM_COLORS } from '@/data/detections';

const matrixStats = getMatrixStats();
const activeDetections = DETECTIONS.filter((d) => d.status === 'Active');
const testingDetections = DETECTIONS.filter((d) => d.status === 'Testing');
const avgFpRate = Math.round(
  activeDetections.reduce((s, d) => s + d.metrics.fpRate, 0) / activeDetections.length,
);
const avgMttd = (
  activeDetections.reduce((s, d) => s + d.metrics.mttd, 0) / activeDetections.length
).toFixed(1);
const totalAlertsDay = activeDetections.reduce((s, d) => s + d.metrics.alertsPerDay, 0).toFixed(1);

const tacticGaps = ATTACK_MATRIX.map((t) => ({
  name: t.shortName,
  count: t.techniques.filter((tech) => tech.coverage > 0).length,
})).filter((t) => t.count === 0);

const recentUpdates = DETECTIONS.filter((d) => d.status !== 'Draft')
  .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
  .slice(0, 6);

const SIEM_HEALTH = [
  {
    name: 'Splunk',
    status: 'healthy',
    detections: DETECTIONS.filter((d) => d.siem === 'Splunk').length,
    lastSync: '2m ago',
    latency: 48,
  },
  {
    name: 'Sentinel',
    status: 'healthy',
    detections: DETECTIONS.filter((d) => d.siem === 'Microsoft Sentinel').length,
    lastSync: '8m ago',
    latency: 61,
  },
  {
    name: 'Chronicle',
    status: 'warning',
    detections: DETECTIONS.filter((d) => d.siem === 'Chronicle').length,
    lastSync: '41m ago',
    latency: 0,
  },
  {
    name: 'Elastic',
    status: 'healthy',
    detections: DETECTIONS.filter((d) => d.siem === 'Elastic').length,
    lastSync: '5m ago',
    latency: 33,
  },
];

export default function DashboardPage() {
  const user = useCurrentUser();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="SOC Command Center" />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* ── Banner ───────────────────────────────────────────────── */}
        <div className="flex items-end justify-between pb-4 border-b border-black/10 dark:border-white/10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {greeting}, {user?.firstName ?? 'Analyst'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
              Real-time defensive posture audit and active threat responder.
            </p>
          </div>
          <Link
            href="/coverage"
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
          >
            <Target className="h-3.5 w-3.5" />
            Coverage Navigator <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* ── KPI row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="MITRE ATT&CK COVERAGE"
            value={`${matrixStats.pct}%`}
            sub={`${matrixStats.covered}/${matrixStats.total} techniques mapped`}
            badge="Goal: >80%"
            badgeColor="text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border-emerald-500/20"
            icon={Target}
            iconColor="text-amber-400"
            trendLabel="+3% this month"
            href="/coverage"
            linkLabel="Open coverage navigator"
          />
          <KpiCard
            label="ACTIVE RULES"
            value={String(activeDetections.length)}
            sub={`${DETECTIONS.length} total in library · ${testingDetections.length} in testing`}
            badge="DaaS Library"
            badgeColor="text-violet-600 dark:text-violet-400 bg-violet-500/20 border-violet-500/20"
            icon={ShieldCheck}
            iconColor="text-violet-400"
            trendLabel="+2 this week"
            href="/detections"
            linkLabel="Browse detection list"
          />
          <KpiCard
            label="FALSE POSITIVE RATE"
            value={`${avgFpRate}%`}
            sub="Avg across active rules"
            badge="Limit: <5%"
            badgeColor="text-orange-600 dark:text-orange-400 bg-orange-500/20 border-orange-500/20"
            icon={AlertTriangle}
            iconColor="text-orange-400"
            trendLabel="-2% vs last month"
            href="/reports"
            linkLabel="Review weekly briefs"
          />
          <KpiCard
            label="MEAN TIME TO DETECT"
            value={`${avgMttd}h`}
            sub={`${totalAlertsDay} alerts/day avg`}
            badge="SLA: <1h"
            badgeColor="text-amber-600 dark:text-amber-400 bg-amber-500/20 border-amber-500/20"
            icon={Clock}
            iconColor="text-purple-400"
            trendLabel="-0.4h improvement"
            href="/siem"
            linkLabel="Monitor pipeline"
          />
        </div>

        {/* ── 3-column main section ────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Col 1: Behavioral Tactic Distribution */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Behavioral Tactic Distribution
              </h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Detections mapped across all 14 MITRE tactics.
              </p>
            </div>

            <div className="space-y-1.5">
              {ATTACK_MATRIX.map((tactic) => {
                const covered = tactic.techniques.filter((t) => t.coverage > 0).length;
                const pct = Math.round((covered / tactic.techniques.length) * 100);
                return (
                  <div key={tactic.id} className="flex items-center gap-2">
                    <div className="w-24 text-[10px] text-slate-400 dark:text-zinc-400 truncate text-right pr-1 shrink-0">
                      {tactic.shortName}
                    </div>
                    <div className="flex-1 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 h-5 rounded flex items-center px-1 overflow-hidden">
                      <div
                        className={cn(
                          'h-3.5 rounded transition-all duration-500',
                          pct > 60
                            ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                            : covered > 0
                              ? 'bg-slate-300 dark:bg-white/30'
                              : 'bg-slate-100 dark:bg-white/10',
                        )}
                        style={{ width: `${Math.max(pct, covered > 0 ? 5 : 1)}%` }}
                      />
                      {covered > 0 && (
                        <span className="text-[9px] font-bold text-slate-700 dark:text-white pl-1.5 z-10">
                          {covered}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 2: SIEM Ingestion Health */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-slate-400 dark:text-zinc-400" /> SIEM Ingestion
                  Health
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  Live ingest pipeline status.
                </p>
              </div>
              <Link
                href="/siem"
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Configure
              </Link>
            </div>

            <div className="space-y-2">
              {SIEM_HEALTH.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/5 transition-all"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">{s.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      {s.detections} rules · {s.lastSync}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-700 dark:text-zinc-300">
                        {s.latency > 0 ? `${s.latency}ms` : 'Offline'}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500">latency</p>
                    </div>
                    <span className="relative flex h-2 w-2">
                      {s.status === 'healthy' ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </>
                      ) : (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-black/10 dark:border-white/10 pt-3">
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-2 uppercase tracking-widest font-semibold">
                Active Rules Preview
              </p>
              <ul className="space-y-1.5">
                {activeDetections.slice(0, 3).map((det) => (
                  <li key={det.id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-slate-700 dark:text-zinc-300 max-w-[160px]">
                      {det.title}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-2',
                        SEVERITY_COLORS[det.severity],
                      )}
                    >
                      {det.severity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Col 3: Active Gap Alerts (top) + Recent Updates (bottom) */}
          <div className="space-y-4">
            {/* Active Gap Alerts */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-50 dark:bg-orange-500/5 backdrop-blur-md p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" /> Active Gap Alerts ({tacticGaps.length})
                </h3>
                <Link
                  href="/coverage"
                  className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Navigator
                </Link>
              </div>
              {tacticGaps.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Zero defense gaps — full tactic coverage.
                  </p>
                </div>
              ) : (
                tacticGaps.slice(0, 3).map((gap, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-orange-500 uppercase">
                        TACTIC VOID
                      </span>
                      <span className="text-[9px] bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 rounded font-semibold border border-red-200 dark:border-red-500/20">
                        CRITICAL
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-zinc-300">
                      No detections for: <strong>{gap.name}</strong>
                    </p>
                    <Link
                      href="/coverage"
                      className="text-[10px] text-orange-500 dark:text-orange-400 inline-flex items-center gap-0.5 hover:underline"
                    >
                      Deploy coverage rule <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                ))
              )}
            </div>

            {/* Recent Updates */}
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Updates
              </h3>
              <ul className="space-y-2.5">
                {recentUpdates.map((det) => (
                  <li key={det.id} className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold',
                        STATUS_COLORS[det.status],
                      )}
                    >
                      {det.status === 'Active' ? '✓' : det.status === 'Testing' ? '⚡' : '✎'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-white line-clamp-1">
                        {det.title}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {det.techniqueId} · {det.lastUpdated}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href="/detections"
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                View all detections <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Detection table ───────────────────────────────────────── */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Active Telemetry Response Stream
            </h3>
            <Link
              href="/detections"
              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              Full library <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-600 dark:text-zinc-300">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-slate-400 dark:text-zinc-500 text-xs bg-black/5 dark:bg-black/20">
                  {[
                    'ID',
                    'Detection',
                    'Technique',
                    'SIEM Engine',
                    'Severity',
                    'FP Rate',
                    'Alerts/Day',
                  ].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {activeDetections.slice(0, 6).map((det) => (
                  <tr
                    key={det.id}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-zinc-500">
                      {det.id}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-slate-900 dark:text-white text-xs truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {det.title}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{det.tactic}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {det.techniqueId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium',
                          SIEM_COLORS[det.siem],
                        )}
                      >
                        {det.siem === 'Microsoft Sentinel' ? 'Sentinel' : det.siem}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                          SEVERITY_COLORS[det.severity],
                        )}
                      >
                        {det.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={cn(
                          'font-medium',
                          det.metrics.fpRate > 15
                            ? 'text-red-500 dark:text-red-400'
                            : det.metrics.fpRate > 8
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {det.metrics.fpRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-zinc-300">
                      {det.metrics.alertsPerDay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  badge,
  badgeColor,
  icon: Icon,
  iconColor,
  trendLabel: _trendLabel,
  href,
  linkLabel,
}: {
  label: string;
  value: string;
  sub: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  iconColor: string;
  trendLabel: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
        <Icon className={cn('h-16 w-16', iconColor)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', badgeColor)}>
          {badge}
        </span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
        {value}
      </p>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-400 mt-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>{sub}</span>
      </div>
      <Link
        href={href}
        className="mt-2.5 flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
      >
        {linkLabel} <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
