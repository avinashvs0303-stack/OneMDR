'use client';

import { useState, useEffect } from 'react';
import { Plus, X, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { listChanges, createChange, updateChangeStatus } from '@/lib/soc.api';
import type { SocChange } from '@/lib/soc.api';
import { cn } from '@/lib/utils';

const STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'IMPLEMENTING', 'COMPLETED', 'REJECTED'] as const;
type ChangeStatus = (typeof STATUSES)[number];

const STATUS_NEXT: Record<ChangeStatus, ChangeStatus | null> = {
  DRAFT: 'REVIEW',
  REVIEW: 'APPROVED',
  APPROVED: 'IMPLEMENTING',
  IMPLEMENTING: 'COMPLETED',
  COMPLETED: null,
  REJECTED: null,
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  IMPLEMENTING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const RISK_STYLE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-amber-600 dark:text-amber-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  CRITICAL: 'text-red-600 dark:text-red-400',
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  STANDARD: 'STD',
  NORMAL: 'NOR',
  EMERGENCY: 'EMG',
};

interface CreateForm {
  title: string;
  description: string;
  changeType: string;
  priority: string;
  riskLevel: string;
  impact: string;
  rollbackPlan: string;
  scheduledStart: string;
  scheduledEnd: string;
}

const emptyForm = (): CreateForm => ({
  title: '',
  description: '',
  changeType: 'STANDARD',
  priority: 'MEDIUM',
  riskLevel: 'LOW',
  impact: '',
  rollbackPlan: '',
  scheduledStart: '',
  scheduledEnd: '',
});

export default function ChangesPage() {
  const [changes, setChanges] = useState<SocChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<SocChange | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await listChanges(filterStatus || undefined);
      setChanges(data);
    } catch {
      setError('Failed to load change requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filterStatus]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createChange({
        title: form.title,
        description: form.description,
        changeType: form.changeType,
        priority: form.priority,
        riskLevel: form.riskLevel,
        impact: form.impact,
        rollbackPlan: form.rollbackPlan,
        scheduledStart: form.scheduledStart || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
      });
      setCreateOpen(false);
      setForm(emptyForm());
      await load();
    } catch {
      setError('Failed to create change');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async (change: SocChange) => {
    const next = STATUS_NEXT[change.status as ChangeStatus];
    if (!next) return;
    try {
      await updateChangeStatus(change.id, { status: next });
      await load();
      if (selected?.id === change.id) {
        setSelected((prev) => (prev ? { ...prev, status: next } : null));
      }
    } catch {
      setError('Failed to update status');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await updateChangeStatus(rejectModal.id, { status: 'REJECTED', rejectionNote: rejectNote });
      setRejectModal(null);
      setRejectNote('');
      await load();
      if (selected?.id === rejectModal.id) setSelected(null);
    } catch {
      setError('Failed to reject');
    }
  };

  const kpis = {
    total: changes.length,
    draft: changes.filter((c) => c.status === 'DRAFT').length,
    inFlight: changes.filter((c) => ['REVIEW', 'APPROVED', 'IMPLEMENTING'].includes(c.status))
      .length,
    completed: changes.filter((c) => c.status === 'COMPLETED').length,
  };

  if (selected) {
    const next = STATUS_NEXT[selected.status as ChangeStatus];
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-lg border border-black/10 dark:border-white/10 p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4 rotate-180 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">{selected.changeRef}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  STATUS_STYLE[selected.status],
                )}
              >
                {selected.status}
              </span>
              <span className={cn('text-[10px] font-semibold', PRIORITY_STYLE[selected.priority])}>
                {selected.priority}
              </span>
            </div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
              {selected.title}
            </h1>
          </div>
          <div className="flex gap-2 shrink-0">
            {next && (
              <button
                type="button"
                onClick={() => void handleAdvance(selected)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Move to {next}
              </button>
            )}
            {!['COMPLETED', 'REJECTED'].includes(selected.status) && (
              <button
                type="button"
                onClick={() => {
                  setRejectModal({ id: selected.id });
                }}
                className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Reject
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Timeline */}
          <div className="flex items-center gap-1">
            {STATUSES.filter((s) => s !== 'REJECTED').map((s, i, arr) => {
              const si = STATUSES.indexOf(selected.status as ChangeStatus);
              const ti = arr.indexOf(s);
              const done = si > ti || selected.status === s;
              const active = selected.status === s;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={cn(
                      'flex-1 h-0.5 rounded-full',
                      i > 0 ? (done ? 'bg-blue-500' : 'bg-slate-200 dark:bg-zinc-700') : 'hidden',
                    )}
                  />
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full w-6 h-6 text-[9px] font-bold border-2 transition-all',
                      active
                        ? 'bg-blue-600 border-blue-600 text-white scale-110'
                        : done
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-400',
                    )}
                  >
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 dark:text-zinc-500">
            {STATUSES.filter((s) => s !== 'REJECTED').map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailCard label="Change Type" value={selected.changeType} />
            <DetailCard
              label="Risk Level"
              value={
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    RISK_STYLE[selected.riskLevel],
                  )}
                >
                  {selected.riskLevel}
                </span>
              }
            />
            <DetailCard
              label="Scheduled Start"
              value={
                selected.scheduledStart ? new Date(selected.scheduledStart).toLocaleString() : '—'
              }
            />
            <DetailCard
              label="Scheduled End"
              value={selected.scheduledEnd ? new Date(selected.scheduledEnd).toLocaleString() : '—'}
            />
            <DetailCard label="Requested By" value={selected.requesterName ?? '—'} />
            <DetailCard label="Approved By" value={selected.approverName ?? '—'} />
          </div>

          {selected.description && <Section label="Description" value={selected.description} />}
          {selected.impact && <Section label="Impact" value={selected.impact} />}
          {selected.rollbackPlan && <Section label="Rollback Plan" value={selected.rollbackPlan} />}
          {selected.rejectionNote && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                Rejection Note
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">{selected.rejectionNote}</p>
            </div>
          )}
        </div>

        {rejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-96 shadow-xl">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Reject Change?</h3>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejection…"
                rows={3}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Change Management</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            RFC lifecycle — Draft → Review → Approved → Implementing → Completed
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setForm(emptyForm());
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Change
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-black/10 dark:border-white/10">
        {[
          { label: 'Total', value: kpis.total, color: 'text-slate-700 dark:text-zinc-200' },
          { label: 'Draft', value: kpis.draft, color: 'text-slate-500 dark:text-zinc-400' },
          { label: 'In Flight', value: kpis.inFlight, color: 'text-blue-600 dark:text-blue-400' },
          {
            label: 'Completed',
            value: kpis.completed,
            color: 'text-green-600 dark:text-green-400',
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-3 text-center"
          >
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
            <div className="text-[11px] text-slate-400 dark:text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-6 py-3 border-b border-black/10 dark:border-white/10 overflow-x-auto">
        {['', ...STATUSES].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium border whitespace-nowrap transition-colors',
              filterStatus === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading changes…
          </div>
        ) : changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">No change requests found</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Create first change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {changes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{c.changeRef}</span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                        {CHANGE_TYPE_LABEL[c.changeType]}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          STATUS_STYLE[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold',
                          RISK_STYLE[c.riskLevel],
                          'rounded-full px-2 py-0.5',
                        )}
                      >
                        {c.riskLevel} RISK
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-[10px] font-semibold', PRIORITY_STYLE[c.priority])}>
                      {c.priority}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-[560px] shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">New Change Request</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Title *">
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Brief change title"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What is being changed?"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <select
                    value={form.changeType}
                    onChange={(e) => setForm((p) => ({ ...p, changeType: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="NORMAL">Normal</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </Field>
                <Field label="Risk">
                  <select
                    value={form.riskLevel}
                    onChange={(e) => setForm((p) => ({ ...p, riskLevel: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </Field>
              </div>
              <Field label="Impact">
                <textarea
                  value={form.impact}
                  onChange={(e) => setForm((p) => ({ ...p, impact: e.target.value }))}
                  placeholder="What systems/services will be affected?"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </Field>
              <Field label="Rollback Plan">
                <textarea
                  value={form.rollbackPlan}
                  onChange={(e) => setForm((p) => ({ ...p, rollbackPlan: e.target.value }))}
                  placeholder="How to revert if something goes wrong?"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Scheduled Start">
                  <input
                    type="datetime-local"
                    value={form.scheduledStart}
                    onChange={(e) => setForm((p) => ({ ...p, scheduledStart: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
                <Field label="Scheduled End">
                  <input
                    type="datetime-local"
                    value={form.scheduledEnd}
                    onChange={(e) => setForm((p) => ({ ...p, scheduledEnd: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving || !form.title.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit RFC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-3">
      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-700 dark:text-zinc-200">{value}</div>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
