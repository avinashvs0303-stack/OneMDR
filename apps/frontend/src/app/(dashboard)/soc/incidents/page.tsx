'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Plus, X, Clock, ChevronDown, Filter, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/store/auth.store';
import {
  listIncidents,
  createIncident,
  updateIncidentStatus,
  type SocIncident,
} from '@/lib/soc.api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'P1' | 'P2' | 'P3' | 'P4';
type IncidentStatus = 'NEW' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<
  Severity,
  { label: string; badgeClass: string; responseSec: number; resolutionSec: number }
> = {
  P1: {
    label: 'Critical',
    badgeClass:
      'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
    responseSec: 15 * 60,
    resolutionSec: 60 * 60,
  },
  P2: {
    label: 'High',
    badgeClass:
      'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
    responseSec: 30 * 60,
    resolutionSec: 4 * 60 * 60,
  },
  P3: {
    label: 'Medium',
    badgeClass:
      'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/25',
    responseSec: 2 * 60 * 60,
    resolutionSec: 24 * 60 * 60,
  },
  P4: {
    label: 'Low',
    badgeClass:
      'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
    responseSec: 24 * 60 * 60,
    resolutionSec: 72 * 60 * 60,
  },
};

const STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; class: string; next: IncidentStatus | null }
> = {
  NEW: {
    label: 'New',
    class:
      'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25',
    next: 'INVESTIGATING',
  },
  INVESTIGATING: {
    label: 'Investigating',
    class:
      'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
    next: 'MITIGATED',
  },
  MITIGATED: {
    label: 'Mitigated',
    class:
      'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/25',
    next: 'RESOLVED',
  },
  RESOLVED: {
    label: 'Resolved',
    class:
      'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
    next: null,
  },
};

const isSeverity = (s: string): s is Severity => ['P1', 'P2', 'P3', 'P4'].includes(s);
const isStatus = (s: string): s is IncidentStatus =>
  ['NEW', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'].includes(s);

// ── SLA countdown ─────────────────────────────────────────────────────────────

function SlaTimer({
  createdAt,
  severity,
  status,
}: {
  createdAt: string;
  severity: string;
  status: string;
}) {
  const [remaining, setRemaining] = useState<number>(0);

  const sev = isSeverity(severity) ? severity : 'P2';

  useEffect(() => {
    if (status === 'RESOLVED') return;
    const resolutionMs = SEV_CONFIG[sev].resolutionSec * 1000;
    const deadline = new Date(createdAt).getTime() + resolutionMs;
    const tick = () => setRemaining(deadline - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [createdAt, sev, status]);

  if (status === 'RESOLVED')
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Resolved</span>
    );

  const breached = remaining < 0;
  const abs = Math.abs(remaining);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const fmt = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs font-mono font-semibold',
        breached ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-zinc-300',
      )}
    >
      <Clock className="h-3 w-3" />
      {breached ? `−${fmt} BREACHED` : fmt}
    </span>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    severity: Severity;
    title: string;
    description: string;
    assigneeName: string;
  }) => Promise<void>;
}) {
  const [sev, setSev] = useState<Severity>('P2');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        severity: sev,
        title: title.trim(),
        description: desc.trim(),
        assigneeName: assignee.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-5 mx-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Create Incident</h2>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Severity
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['P1', 'P2', 'P3', 'P4'] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSev(s)}
                className={cn(
                  'rounded-lg border py-2 text-sm font-bold transition-all',
                  sev === s
                    ? SEV_CONFIG[s].badgeClass
                    : 'border-black/10 dark:border-white/10 text-slate-500 hover:border-black/20 dark:hover:border-white/20',
                )}
              >
                {s} — {SEV_CONFIG[s].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Response SLA:{' '}
            {SEV_CONFIG[sev].responseSec / 60 < 60
              ? `${SEV_CONFIG[sev].responseSec / 60} min`
              : `${SEV_CONFIG[sev].responseSec / 3600} hr`}
            {' · '}
            Resolution SLA:{' '}
            {SEV_CONFIG[sev].resolutionSec / 3600 >= 1
              ? `${SEV_CONFIG[sev].resolutionSec / 3600} hr`
              : `${SEV_CONFIG[sev].resolutionSec / 60} min`}
          </p>
        </div>

        {[
          {
            label: 'Title *',
            value: title,
            set: setTitle,
            placeholder: 'e.g. Ransomware detected on PROD-DC-01',
          },
          {
            label: 'Assigned to',
            value: assignee,
            set: setAssignee,
            placeholder: 'Analyst name (optional)',
          },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label} className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
              {label}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
            Description
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Affected systems, initial indicators, timeline..."
            className="block w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!title.trim() || saving}
            onClick={() => void submit()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Incident
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const user = useCurrentUser();
  const [incidents, setIncidents] = useState<SocIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filterSev, setFilterSev] = useState<Severity | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'ALL'>('ALL');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await listIncidents();
      setIncidents(data);
    } catch {
      setError('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = incidents.filter(
    (i) =>
      (filterSev === 'ALL' || i.severity === filterSev) &&
      (filterStatus === 'ALL' || i.status === filterStatus),
  );

  const stats = {
    p1Active: incidents.filter((i) => i.severity === 'P1' && i.status !== 'RESOLVED').length,
    p2Active: incidents.filter((i) => i.severity === 'P2' && i.status !== 'RESOLVED').length,
    breached: incidents.filter((i) => i.slaBreached && i.status !== 'RESOLVED').length,
    resolved24h: incidents.filter(
      (i) =>
        i.status === 'RESOLVED' &&
        i.resolvedAt &&
        Date.now() - new Date(i.resolvedAt).getTime() < 86400000,
    ).length,
  };

  const advance = async (inc: SocIncident) => {
    const status = isStatus(inc.status) ? inc.status : 'NEW';
    const next = STATUS_CONFIG[status].next;
    if (!next) return;
    try {
      await updateIncidentStatus(inc.id, { status: next });
      await load();
    } catch {
      setError('Failed to update incident status');
    }
  };

  const handleCreate = async (data: {
    severity: Severity;
    title: string;
    description: string;
    assigneeName: string;
  }) => {
    await createIncident({
      severity: data.severity,
      title: data.title,
      description: data.description,
      assigneeName: data.assigneeName || user?.firstName || undefined,
    });
    await load();
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Incident Tracker" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Active P1',
              value: stats.p1Active,
              cls: 'text-red-700 dark:text-red-300',
              bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25',
            },
            {
              label: 'Active P2',
              value: stats.p2Active,
              cls: 'text-amber-700 dark:text-amber-300',
              bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25',
            },
            {
              label: 'SLA Breached',
              value: stats.breached,
              cls: 'text-rose-700 dark:text-rose-300',
              bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25',
            },
            {
              label: 'Resolved (24h)',
              value: stats.resolved24h,
              cls: 'text-emerald-700 dark:text-emerald-300',
              bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25',
            },
          ].map(({ label, value, cls, bg }) => (
            <div key={label} className={cn('rounded-xl border p-4 space-y-1', bg)}>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                {label}
              </p>
              <p className={cn('text-3xl font-black', cls)}>{loading ? '—' : value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="h-4 w-4" /> New Incident
          </button>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            {(['ALL', 'P1', 'P2', 'P3', 'P4'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterSev(s)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                  filterSev === s
                    ? s === 'ALL'
                      ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : isSeverity(s)
                        ? SEV_CONFIG[s].badgeClass
                        : ''
                    : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:border-black/20',
                )}
              >
                {s}
              </button>
            ))}
            <span className="mx-1 text-slate-300 dark:text-white/10">|</span>
            {(['ALL', 'NEW', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                  filterStatus === s
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:border-black/20',
                )}
              >
                {s === 'ALL' ? 'All Status' : isStatus(s) ? STATUS_CONFIG[s].label : s}
              </button>
            ))}
          </div>
        </div>

        {/* Incident table */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-3 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
            <span className="col-span-1">Ref</span>
            <span className="col-span-1">Sev</span>
            <span className="col-span-4">Title</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">SLA Timer</span>
            <span className="col-span-2">Assignee</span>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400 dark:text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading incidents…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500">
                {incidents.length === 0
                  ? 'No incidents yet. Create one to get started.'
                  : 'No incidents match the current filter.'}
              </div>
            ) : (
              filtered.map((inc) => {
                const sev = isSeverity(inc.severity) ? inc.severity : 'P2';
                const status = isStatus(inc.status) ? inc.status : 'NEW';
                const sc = SEV_CONFIG[sev];
                const stc = STATUS_CONFIG[status];
                return (
                  <div
                    key={inc.id}
                    className={cn(
                      'grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
                      inc.slaBreached && inc.status !== 'RESOLVED' && 'border-l-2 border-l-red-500',
                    )}
                  >
                    <span className="col-span-1 text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                      {inc.incidentRef}
                    </span>
                    <span className="col-span-1">
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-bold',
                          sc.badgeClass,
                        )}
                      >
                        {inc.severity}
                      </span>
                    </span>
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {inc.title}
                      </p>
                      {inc.description && (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                          {inc.description}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => void advance(inc)}
                        disabled={stc.next === null}
                        className={cn(
                          'group flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all',
                          stc.class,
                          stc.next && 'hover:opacity-75 cursor-pointer',
                        )}
                      >
                        {stc.label}
                        {stc.next && (
                          <ChevronDown className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </div>
                    <div className="col-span-2">
                      <SlaTimer
                        createdAt={inc.createdAt}
                        severity={inc.severity}
                        status={inc.status}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      {inc.assigneeName ? (
                        <>
                          <div className="h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {inc.assigneeName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                            {inc.assigneeName}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-zinc-500 italic">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
