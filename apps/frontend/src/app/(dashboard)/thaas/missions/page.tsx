'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Plus, X, Loader2, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  huntsApi,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  EVIDENCE_TYPE_CONFIG,
  IOC_TYPE_LABELS,
  TACTIC_OPTIONS,
  type HuntMission,
  type HuntStatus,
  type HuntPriority,
  type HuntEvidenceType,
  type HuntIOCType,
  type HuntEvidence,
  type HuntIOC,
} from '@/lib/hunts.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: HuntStatus[] = ['ACTIVE', 'PLANNED', 'COMPLETE', 'ARCHIVED'];
const PRIORITIES: HuntPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const EVIDENCE_TYPES: HuntEvidenceType[] = ['FINDING', 'FALSE_POSITIVE', 'ARTIFACT', 'NOTE'];
const IOC_TYPES: HuntIOCType[] = [
  'IP',
  'DOMAIN',
  'HASH_MD5',
  'HASH_SHA1',
  'HASH_SHA256',
  'URL',
  'EMAIL',
  'REGISTRY_KEY',
  'FILE_PATH',
  'OTHER',
];

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HuntMissionsPage() {
  const [missions, setMissions] = useState<HuntMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<HuntStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<HuntPriority | ''>('');

  const [selected, setSelected] = useState<HuntMission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await huntsApi.list({
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterPriority ? { priority: filterPriority } : {}),
      });
      setMissions(data);
    } catch {
      setError('Failed to load hunt missions');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openDetail = async (m: HuntMission) => {
    setSelected(m);
    setDetailLoading(true);
    try {
      const full = await huntsApi.get(m.id);
      setSelected(full);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: HuntStatus) => {
    await huntsApi.update(id, { status });
    await reload();
    if (selected?.id === id) {
      const full = await huntsApi.get(id);
      setSelected(full);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this hunt mission and all its evidence?')) return;
    await huntsApi.remove(id);
    if (selected?.id === id) setSelected(null);
    await reload();
  };

  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    items: missions.filter((m) => m.status === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Hunt Missions" />

      {/* Controls */}
      <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md px-6 py-3 shrink-0">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as HuntStatus | '')}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="">All Statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as HuntPriority | '')}
          className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_CONFIG[p].label}
            </option>
          ))}
        </select>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-sm shadow-purple-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> New Mission
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mission list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : missions.length === 0 ? (
            <EmptyState onNew={() => setShowNewModal(true)} />
          ) : (
            grouped.map(({ status, items }) => {
              const sc = STATUS_CONFIG[status];
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      {sc.label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-600">
                      ({items.length})
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((m) => (
                      <MissionRow
                        key={m.id}
                        mission={m}
                        selected={selected?.id === m.id}
                        onClick={() => {
                          void openDetail(m);
                        }}
                        onStatusChange={(id, s) => {
                          void handleStatusChange(id, s);
                        }}
                        onDelete={(id) => {
                          void handleDelete(id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            mission={selected}
            loading={detailLoading}
            onClose={() => setSelected(null)}
            onReload={async () => {
              await reload();
              const full = await huntsApi.get(selected.id);
              setSelected(full);
            }}
          />
        )}
      </div>

      {showNewModal && (
        <NewMissionModal
          onClose={() => setShowNewModal(false)}
          onCreated={(m) => {
            setShowNewModal(false);
            void reload().then(() => openDetail(m));
          }}
        />
      )}
    </div>
  );
}

// ── Mission row ───────────────────────────────────────────────────────────────

function MissionRow({
  mission: m,
  selected,
  onClick,
  onStatusChange,
  onDelete,
}: {
  mission: HuntMission;
  selected: boolean;
  onClick: () => void;
  onStatusChange: (id: string, s: HuntStatus) => void;
  onDelete: (id: string) => void;
}) {
  const sc = STATUS_CONFIG[m.status];
  const pc = PRIORITY_CONFIG[m.priority];

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 cursor-pointer transition-all hover:bg-white/90 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20',
        selected
          ? 'border-purple-500/40 bg-purple-50/50 dark:bg-purple-500/10 ring-1 ring-purple-500/30'
          : 'border-black/10 dark:border-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', sc.dot)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.title}</p>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">{m.missionRef}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              {m.hypothesis}
            </p>
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] text-slate-400 dark:text-zinc-500">
              {m.tactic && <span className="font-mono">{m.tactic}</span>}
              {m._count?.evidence ? (
                <span>
                  {m._count.evidence} finding{m._count.evidence !== 1 ? 's' : ''}
                </span>
              ) : null}
              {m._count?.iocs ? (
                <span>
                  {m._count.iocs} IOC{m._count.iocs !== 1 ? 's' : ''}
                </span>
              ) : null}
              {m.analystName && <span>by {m.analystName}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              pc.className,
            )}
          >
            {pc.label}
          </span>
          <select
            value={m.status}
            onChange={(e) => {
              onStatusChange(m.id, e.target.value as HuntStatus);
            }}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-semibold focus:outline-none cursor-pointer',
              sc.badge,
            )}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              onDelete(m.id);
            }}
            className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  mission: m,
  loading,
  onClose,
  onReload,
}: {
  mission: HuntMission;
  loading: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'overview' | 'evidence' | 'iocs'>('overview');
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [addingIOC, setAddingIOC] = useState(false);
  const [busy, setBusy] = useState(false);

  // Evidence form
  const [evTitle, setEvTitle] = useState('');
  const [evBody, setEvBody] = useState('');
  const [evType, setEvType] = useState<HuntEvidenceType>('FINDING');
  const [evSeverity, setEvSeverity] = useState('HIGH');

  // IOC form
  const [iocType, setIocType] = useState<HuntIOCType>('IP');
  const [iocValue, setIocValue] = useState('');
  const [iocConf, setIocConf] = useState('HIGH');
  const [iocNotes, setIocNotes] = useState('');

  const submitEvidence = async () => {
    if (!evTitle.trim() || !evBody.trim()) return;
    setBusy(true);
    try {
      await huntsApi.addEvidence(m.id, {
        type: evType,
        title: evTitle,
        body: evBody,
        severity: evSeverity as 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
      });
      setEvTitle('');
      setEvBody('');
      setAddingEvidence(false);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const deleteEvidence = async (ev: HuntEvidence) => {
    await huntsApi.removeEvidence(m.id, ev.id);
    await onReload();
  };

  const submitIOC = async () => {
    if (!iocValue.trim()) return;
    setBusy(true);
    try {
      await huntsApi.addIOC(m.id, {
        type: iocType,
        value: iocValue,
        confidence: iocConf as 'HIGH' | 'MEDIUM' | 'LOW',
        notes: iocNotes || undefined,
      });
      setIocValue('');
      setIocNotes('');
      setAddingIOC(false);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const deleteIOC = async (ioc: HuntIOC) => {
    await huntsApi.removeIOC(m.id, ioc.id);
    await onReload();
  };

  const sc = STATUS_CONFIG[m.status];
  const pc = PRIORITY_CONFIG[m.priority];

  return (
    <div className="w-[420px] shrink-0 border-l border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-black/10 dark:border-white/10 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
              {m.missionRef}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold',
                sc.badge,
              )}
            >
              {sc.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold',
                pc.className,
              )}
            >
              {pc.label}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {m.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 dark:border-white/10 shrink-0 px-4">
        {(['overview', 'evidence', 'iocs'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2.5 text-[11px] font-semibold capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-purple-500 text-purple-700 dark:text-purple-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white',
            )}
          >
            {t}
            {t === 'evidence' &&
              m.evidence &&
              ` (${m.evidence.filter((e) => !e.isFalsePositive).length})`}
            {t === 'iocs' && m.iocs && ` (${m.iocs.length})`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab mission={m} />
        ) : tab === 'evidence' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAddingEvidence((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Finding
            </button>

            {addingEvidence && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/5 p-3 space-y-2">
                <select
                  value={evType}
                  onChange={(e) => setEvType(e.target.value as HuntEvidenceType)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                >
                  {EVIDENCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVIDENCE_TYPE_CONFIG[t].label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Title"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <textarea
                  placeholder="Description / raw log entry / artifact details..."
                  value={evBody}
                  onChange={(e) => setEvBody(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
                <select
                  value={evSeverity}
                  onChange={(e) => setEvSeverity(e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                >
                  {['HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void submitEvidence();
                    }}
                    className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingEvidence(false)}
                    className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!m.evidence || m.evidence.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
                No evidence recorded yet
              </p>
            ) : (
              m.evidence.map((ev) => (
                <EvidenceCard
                  key={ev.id}
                  evidence={ev}
                  onDelete={() => {
                    void deleteEvidence(ev);
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAddingIOC((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add IOC
            </button>

            {addingIOC && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-3 space-y-2">
                <select
                  value={iocType}
                  onChange={(e) => setIocType(e.target.value as HuntIOCType)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                >
                  {IOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {IOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Value (e.g. 192.168.1.1, malware.exe, evil.com)"
                  value={iocValue}
                  onChange={(e) => setIocValue(e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
                <select
                  value={iocConf}
                  onChange={(e) => setIocConf(e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                >
                  {['HIGH', 'MEDIUM', 'LOW'].map((c) => (
                    <option key={c} value={c}>
                      {c} Confidence
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Notes (optional)"
                  value={iocNotes}
                  onChange={(e) => setIocNotes(e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void submitIOC();
                    }}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Save IOC'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingIOC(false)}
                    className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!m.iocs || m.iocs.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
                No IOCs recorded yet
              </p>
            ) : (
              m.iocs.map((ioc) => (
                <IOCCard
                  key={ioc.id}
                  ioc={ioc}
                  onDelete={() => {
                    void deleteIOC(ioc);
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ mission: m }: { mission: HuntMission }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
          Hypothesis
        </p>
        <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">{m.hypothesis}</p>
      </div>

      {m.tactic && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
            ATT&CK Tactic
          </p>
          <p className="text-xs text-slate-700 dark:text-zinc-300">
            {m.tactic}{' '}
            <span className="text-slate-400 dark:text-zinc-500 font-mono">({m.tacticId})</span>
          </p>
        </div>
      )}

      {m.techniques.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
            Techniques
          </p>
          <div className="flex flex-wrap gap-1">
            {m.techniques.map((t) => (
              <span
                key={t}
                className="rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Analyst" value={m.analystName || '—'} />
        <Stat label="Start Date" value={fmtDate(m.startDate)} />
        <Stat label="End Date" value={fmtDate(m.endDate)} />
        <Stat label="Created" value={fmtDate(m.createdAt)} />
      </div>

      {m.notes && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">
            Notes
          </p>
          <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {m.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2">
      <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xs font-medium text-slate-700 dark:text-zinc-300 mt-0.5 truncate">
        {value}
      </p>
    </div>
  );
}

function EvidenceCard({
  evidence: ev,
  onDelete,
}: {
  evidence: HuntEvidence;
  onDelete: () => void;
}) {
  const tc = EVIDENCE_TYPE_CONFIG[ev.type];
  const sevColors: Record<string, string> = {
    HIGH: 'text-red-600 dark:text-red-400',
    MEDIUM: 'text-amber-600 dark:text-amber-400',
    LOW: 'text-slate-500 dark:text-zinc-400',
    INFO: 'text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-semibold', tc.color)}>{tc.label}</span>
          <span className={cn('text-[10px] font-semibold', sevColors[ev.severity] ?? '')}>
            {ev.severity}
          </span>
          {ev.isFalsePositive && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 bg-black/5 dark:bg-white/5 rounded px-1 py-0.5">
              FP
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <p className="text-xs font-semibold text-slate-900 dark:text-white">{ev.title}</p>
      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
        {ev.body}
      </p>
      <p className="text-[9px] text-slate-400 dark:text-zinc-600">
        {new Date(ev.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function IOCCard({ ioc, onDelete }: { ioc: HuntIOC; onDelete: () => void }) {
  const confColor: Record<string, string> = {
    HIGH: 'text-red-600 dark:text-red-400',
    MEDIUM: 'text-amber-600 dark:text-amber-400',
    LOW: 'text-slate-400 dark:text-zinc-500',
  };
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
            {IOC_TYPE_LABELS[ioc.type]}
          </span>
          <span className={cn('text-[10px] font-semibold', confColor[ioc.confidence] ?? '')}>
            {ioc.confidence}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <p className="text-xs font-mono text-slate-900 dark:text-white break-all">{ioc.value}</p>
      {ioc.notes && <p className="text-[11px] text-slate-500 dark:text-zinc-400">{ioc.notes}</p>}
      <p className="text-[9px] text-slate-400 dark:text-zinc-600">
        {new Date(ioc.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
        <FileText className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">No hunt missions</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs">
          Create your first hypothesis-driven threat hunt to proactively detect adversary activity.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Create Hunt Mission
      </button>
    </div>
  );
}

// ── New mission modal ─────────────────────────────────────────────────────────

function NewMissionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (m: HuntMission) => void;
}) {
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [priority, setPriority] = useState<HuntPriority>('MEDIUM');
  const [tacticId, setTacticId] = useState('');
  const [techniques, setTechniques] = useState('');
  const [analystName, setAnalystName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tactic = TACTIC_OPTIONS.find((t) => t.id === tacticId);

  const submit = async () => {
    if (!title.trim() || !hypothesis.trim()) {
      setErr('Title and hypothesis are required');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const m = await huntsApi.create({
        title: title.trim(),
        hypothesis: hypothesis.trim(),
        priority,
        tacticId: tacticId || undefined,
        tactic: tactic?.name,
        techniques: techniques
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        analystName: analystName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(m);
    } catch {
      setErr('Failed to create hunt mission');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">New Hunt Mission</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

          <Field label="Mission Title *">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kerberoasting & Pass-the-Hash Campaign"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </Field>

          <Field label="Hypothesis *">
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="Threat actors may be using X technique to achieve Y objective..."
              rows={4}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as HuntPriority)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_CONFIG[p].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="ATT&CK Tactic">
              <select
                value={tacticId}
                onChange={(e) => setTacticId(e.target.value)}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">None</option>
                {TACTIC_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Techniques (comma-separated)">
            <input
              value={techniques}
              onChange={(e) => setTechniques(e.target.value)}
              placeholder="T1558.003, T1550.002"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono"
            />
          </Field>

          <Field label="Lead Analyst">
            <input
              value={analystName}
              onChange={(e) => setAnalystName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Scope, data sources, initial queries..."
              rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create Mission
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
