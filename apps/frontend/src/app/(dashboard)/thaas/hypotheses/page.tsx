'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import {
  huntsApi,
  type HuntMission,
  type HuntStatus,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TACTIC_OPTIONS,
} from '@/lib/hunts.api';
import {
  Microscope,
  Loader2,
  ChevronRight,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

type ValidationState = 'ALL' | 'ACTIVE' | 'COMPLETE' | 'PLANNED' | 'ARCHIVED';

export default function HypothesesPage() {
  const [missions, setMissions] = useState<HuntMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ValidationState>('ALL');
  const [tacticFilter, setTacticFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const data = await huntsApi.list();
      setMissions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = missions.filter((m) => {
    if (filter !== 'ALL' && m.status !== filter) return false;
    if (tacticFilter !== 'ALL' && m.tactic !== tacticFilter) return false;
    return true;
  });

  // Group by MITRE tactic
  const byTactic: Record<string, HuntMission[]> = {};
  for (const m of filtered) {
    const key = m.tactic ?? 'No Tactic Assigned';
    if (!byTactic[key]) byTactic[key] = [];
    byTactic[key].push(m);
  }

  const tacticOrder = [
    'Execution',
    'Persistence',
    'Privilege Escalation',
    'Defense Evasion',
    'Credential Access',
    'Discovery',
    'Lateral Movement',
    'Collection',
    'Command and Control',
    'Exfiltration',
    'Impact',
    'Initial Access',
    'Reconnaissance',
    'Resource Development',
    'No Tactic Assigned',
  ];
  const sortedTactics = Object.keys(byTactic).sort(
    (a, b) => tacticOrder.indexOf(a) - tacticOrder.indexOf(b),
  );

  const activeTactics = [...new Set(missions.map((m) => m.tactic).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <Header title="Hunt Hypotheses" />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Hunt Hypotheses" />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Intelligence-Driven Hypotheses
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              All hunt hypotheses grouped by MITRE ATT&CK tactic.{' '}
              {missions.filter((m) => m.status === 'COMPLETE').length} validated ·{' '}
              {missions.filter((m) => m.status === 'ACTIVE').length} in progress
            </p>
          </div>
          <Link
            href="/thaas/missions"
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
          >
            <Microscope className="h-3.5 w-3.5" />
            New Hunt Mission
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <Filter className="h-3.5 w-3.5" />
          </div>

          {(['ALL', 'ACTIVE', 'PLANNED', 'COMPLETE', 'ARCHIVED'] as ValidationState[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs border transition-colors',
                filter === s
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s as HuntStatus].label}
            </button>
          ))}

          {activeTactics.length > 0 && (
            <select
              value={tacticFilter}
              onChange={(e) => setTacticFilter(e.target.value)}
              className="ml-auto rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs text-slate-800 dark:text-zinc-200 outline-none"
            >
              <option value="ALL">All tactics</option>
              {activeTactics.map((t) => (
                <option key={t} value={t!}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Empty state */}
        {missions.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
              <Microscope className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">No hypotheses yet</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs text-center">
              Create a Hunt Mission with a hypothesis to track your threat hunting intelligence
              here.
            </p>
            <Link
              href="/thaas/missions"
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              Create first mission →
            </Link>
          </div>
        )}

        {/* Grouped by tactic */}
        {sortedTactics.map((tactic) => {
          const tacticMissions = byTactic[tactic];
          const tacticId = TACTIC_OPTIONS.find((t) => t.name === tactic)?.id;
          const activeCount = tacticMissions.filter((m) => m.status === 'ACTIVE').length;
          const completeCount = tacticMissions.filter((m) => m.status === 'COMPLETE').length;
          const plannedCount = tacticMissions.filter((m) => m.status === 'PLANNED').length;

          return (
            <section key={tactic} className="space-y-2">
              <div className="flex items-center gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tactic}</h3>
                  {tacticId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                      {tacticId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
                  {activeCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {activeCount} active
                    </span>
                  )}
                  {plannedCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {plannedCount} planned
                    </span>
                  )}
                  {completeCount > 0 && <span>{completeCount} complete</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {tacticMissions.map((m) => (
                  <HypothesisCard key={m.id} mission={m} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function HypothesisCard({ mission: m }: { mission: HuntMission }) {
  const statusCfg = STATUS_CONFIG[m.status];
  const priorityCfg = PRIORITY_CONFIG[m.priority];

  const StatusIcon =
    m.status === 'COMPLETE'
      ? CheckCircle
      : m.status === 'ACTIVE'
        ? Microscope
        : m.status === 'PLANNED'
          ? Clock
          : XCircle;

  return (
    <Link href="/thaas/missions" className="block">
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                m.status === 'COMPLETE'
                  ? 'text-slate-400'
                  : m.status === 'ACTIVE'
                    ? 'text-emerald-500'
                    : m.status === 'PLANNED'
                      ? 'text-amber-500'
                      : 'text-slate-300',
              )}
            />
            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
              {m.missionRef}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium', statusCfg.badge)}
            >
              {statusCfg.label}
            </span>
            <span
              className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium', priorityCfg.className)}
            >
              {priorityCfg.label}
            </span>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {m.title}
        </p>

        {/* Hypothesis statement */}
        <div className="rounded-lg bg-purple-500/5 border border-purple-500/15 px-2.5 py-2 mb-2">
          <p className="text-[10px] text-slate-600 dark:text-zinc-400 italic line-clamp-3 leading-relaxed">
            &ldquo;{m.hypothesis}&rdquo;
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-zinc-500">
          {m.techniques.length > 0 && (
            <span className="flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {m.techniques.slice(0, 2).join(', ')}
              {m.techniques.length > 2 && ` +${m.techniques.length - 2}`}
            </span>
          )}
          {m._count && (
            <>
              <span>
                {m._count.evidence} finding{m._count.evidence !== 1 ? 's' : ''}
              </span>
              <span>
                {m._count.iocs} IOC{m._count.iocs !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {m.analystName && <span className="ml-auto">{m.analystName}</span>}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
