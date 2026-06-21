'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Crosshair, AlertTriangle, Fingerprint, ArrowRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { huntsApi, type THaaSStats, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/hunts.api';

export default function THaaSDashboard() {
  const [stats, setStats] = useState<THaaSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    huntsApi
      .stats()
      .then(setStats)
      .catch(() => setError('Failed to load hunt statistics'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Threat Hunting as a Service" />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          <KPI
            label="Total Missions"
            value={loading ? '—' : String(stats?.total ?? 0)}
            color="text-slate-900 dark:text-white"
          />
          <KPI
            label="Active"
            value={loading ? '—' : String(stats?.active ?? 0)}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <KPI
            label="Planned"
            value={loading ? '—' : String(stats?.planned ?? 0)}
            color="text-amber-600 dark:text-amber-400"
          />
          <KPI
            label="Complete"
            value={loading ? '—' : String(stats?.complete ?? 0)}
            color="text-slate-600 dark:text-zinc-300"
          />
          <KPI
            label="Critical Priority"
            value={loading ? '—' : String(stats?.critical ?? 0)}
            color="text-red-600 dark:text-red-400"
          />
          <KPI
            label="Findings"
            value={loading ? '—' : String(stats?.evidenceCount ?? 0)}
            color="text-purple-600 dark:text-purple-400"
          />
          <KPI
            label="IOCs Tracked"
            value={loading ? '—' : String(stats?.iocCount ?? 0)}
            color="text-blue-600 dark:text-blue-400"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Active + Planned missions */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Active &amp; Planned Missions
              </h2>
              <Link
                href="/thaas/missions"
                className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : !stats?.recentMissions.length ? (
              <EmptyMissions />
            ) : (
              <div className="space-y-2">
                {stats.recentMissions.map((m) => {
                  const sc = STATUS_CONFIG[m.status];
                  const pc = PRIORITY_CONFIG[m.priority];
                  return (
                    <Link
                      key={m.id}
                      href="/thaas/missions"
                      className="block rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 hover:bg-white/90 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', sc.dot)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {m.title}
                              </p>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
                                {m.missionRef}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                              {m.hypothesis}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              pc.className,
                            )}
                          >
                            {pc.label}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              sc.badge,
                            )}
                          >
                            {sc.label}
                          </span>
                        </div>
                      </div>
                      {m._count?.evidence || m._count?.iocs ? (
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 dark:text-zinc-500">
                          {m._count.evidence > 0 && (
                            <span>
                              {m._count.evidence} finding{m._count.evidence !== 1 ? 's' : ''}
                            </span>
                          )}
                          {m._count.iocs > 0 && (
                            <span>
                              {m._count.iocs} IOC{m._count.iocs !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions + links */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Quick Actions
            </h2>

            <div className="space-y-2">
              <Link
                href="/thaas/missions"
                className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    New Hunt Mission
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Start a new threat hunt
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-purple-500 transition-colors" />
              </Link>

              <Link
                href="/thaas/iocs"
                className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition-all group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Fingerprint className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    IOC Tracker
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {loading ? '—' : `${stats?.iocCount ?? 0} indicators tracked`}
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-blue-500 transition-colors" />
              </Link>

              <Link
                href="/thaas/playbooks"
                className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition-all group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Crosshair className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Hunt Playbooks
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Standard hunting procedures
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition-colors" />
              </Link>

              <Link
                href="/thaas/hypotheses"
                className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition-all group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Hypotheses</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Intelligence-driven hunt hypotheses
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-red-500 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm">
      <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold', color)}>{value}</p>
    </div>
  );
}

function EmptyMissions() {
  return (
    <div className="rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5 p-8 text-center space-y-3">
      <Crosshair className="mx-auto h-8 w-8 text-purple-400 opacity-60" />
      <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No hunt missions yet</p>
      <p className="text-xs text-slate-400 dark:text-zinc-500">
        Start your first threat hunt to proactively uncover adversary activity.
      </p>
      <Link
        href="/thaas/missions"
        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Create First Mission
      </Link>
    </div>
  );
}
