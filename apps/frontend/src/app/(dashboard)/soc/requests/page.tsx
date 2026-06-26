'use client';

import { useState, useEffect } from 'react';
import { Plus, X, ChevronRight, Clock, Ticket } from 'lucide-react';
import { listRequests, createRequest, updateRequestStatus } from '@/lib/soc.api';
import type { SocServiceRequest } from '@/lib/soc.api';
import { cn } from '@/lib/utils';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED', 'CANCELLED'] as const;
type ReqStatus = (typeof STATUSES)[number];

const STATUS_NEXT: Record<ReqStatus, ReqStatus | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'PENDING_APPROVAL',
  PENDING_APPROVAL: 'RESOLVED',
  RESOLVED: null,
  CANCELLED: null,
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  PENDING_APPROVAL: 'Pending',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
};

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORY_LABEL: Record<string, string> = {
  ACCESS: 'Access',
  TOOL: 'Tool',
  REPORT: 'Report',
  TRAINING: 'Training',
  INTEGRATION: 'Integration',
  OTHER: 'Other',
};

interface CreateForm {
  title: string;
  description: string;
  category: string;
  priority: string;
}
const emptyForm = (): CreateForm => ({
  title: '',
  description: '',
  category: 'ACCESS',
  priority: 'MEDIUM',
});

export default function RequestsPage() {
  const [requests, setRequests] = useState<SocServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<SocServiceRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveModal, setResolveModal] = useState<{ id: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setRequests(await listRequests(filterStatus || undefined));
    } catch {
      setError('Failed to load requests');
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
      await createRequest({
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
      });
      setCreateOpen(false);
      setForm(emptyForm());
      await load();
    } catch {
      setError('Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async (req: SocServiceRequest) => {
    const next = STATUS_NEXT[req.status as ReqStatus];
    if (!next) return;
    if (next === 'RESOLVED') {
      setResolveModal({ id: req.id });
      return;
    }
    try {
      await updateRequestStatus(req.id, { status: next });
      await load();
      if (selected?.id === req.id) setSelected((p) => (p ? { ...p, status: next } : null));
    } catch {
      setError('Failed to update');
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    try {
      await updateRequestStatus(resolveModal.id, {
        status: 'RESOLVED',
        resolutionNote: resolveNote,
      });
      setResolveModal(null);
      setResolveNote('');
      await load();
      if (selected?.id === resolveModal.id) setSelected(null);
    } catch {
      setError('Failed to resolve');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await updateRequestStatus(id, { status: 'CANCELLED' });
      await load();
      if (selected?.id === id) setSelected(null);
    } catch {
      setError('Failed to cancel');
    }
  };

  const kpis = {
    open: requests.filter((r) => r.status === 'OPEN').length,
    inProgress: requests.filter(
      (r) => r.status === 'IN_PROGRESS' || r.status === 'PENDING_APPROVAL',
    ).length,
    resolved: requests.filter((r) => r.status === 'RESOLVED').length,
    total: requests.length,
  };

  if (selected) {
    const next = STATUS_NEXT[selected.status as ReqStatus];
    const nextLabel =
      next === 'RESOLVED' ? 'Resolve' : next ? `Move to ${STATUS_LABEL[next]}` : null;
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
              <span className="text-xs font-mono text-slate-400">{selected.requestRef}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  STATUS_STYLE[selected.status],
                )}
              >
                {STATUS_LABEL[selected.status]}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  PRIORITY_STYLE[selected.priority],
                )}
              >
                {selected.priority}
              </span>
            </div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
              {selected.title}
            </h1>
          </div>
          <div className="flex gap-2 shrink-0">
            {nextLabel && (
              <button
                type="button"
                onClick={() => void handleAdvance(selected)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {nextLabel}
              </button>
            )}
            {!['RESOLVED', 'CANCELLED'].includes(selected.status) && (
              <button
                type="button"
                onClick={() => void handleCancel(selected.id)}
                className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Pipeline */}
          <div className="flex items-center gap-1">
            {STATUSES.filter((s) => s !== 'CANCELLED').map((s, i) => {
              const order = ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED'];
              const si = order.indexOf(selected.status);
              const ti = order.indexOf(s);
              const done = si >= ti;
              const active = selected.status === s;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  {i > 0 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 rounded-full',
                        done ? 'bg-blue-500' : 'bg-slate-200 dark:bg-zinc-700',
                      )}
                    />
                  )}
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
            {STATUSES.filter((s) => s !== 'CANCELLED').map((s) => (
              <span key={s}>{STATUS_LABEL[s]}</span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailCard label="Category" value={CATEGORY_LABEL[selected.category]} />
            <DetailCard label="Requested By" value={selected.requesterName ?? '—'} />
            <DetailCard label="Assigned To" value={selected.assigneeName ?? 'Unassigned'} />
            <DetailCard label="Created" value={new Date(selected.createdAt).toLocaleString()} />
          </div>
          {selected.description && <Section label="Description" value={selected.description} />}
          {selected.resolutionNote && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                Resolution Note
              </p>
              <p className="text-sm text-green-600 dark:text-green-300">
                {selected.resolutionNote}
              </p>
            </div>
          )}
        </div>

        {resolveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-96 shadow-xl">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Resolve Request</h3>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Resolution summary…"
                rows={3}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolveModal(null)}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleResolve()}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                >
                  Mark Resolved
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
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Service Requests</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Access, tool, training and integration requests
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
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-black/10 dark:border-white/10">
        {[
          { label: 'Total', value: kpis.total, color: 'text-slate-700 dark:text-zinc-200' },
          { label: 'Open', value: kpis.open, color: 'text-slate-500 dark:text-zinc-400' },
          {
            label: 'In Progress',
            value: kpis.inProgress,
            color: 'text-blue-600 dark:text-blue-400',
          },
          { label: 'Resolved', value: kpis.resolved, color: 'text-green-600 dark:text-green-400' },
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

      {/* Filter */}
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
            {s ? STATUS_LABEL[s] : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Ticket className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">No service requests found</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Submit first request
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{r.requestRef}</span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                        {CATEGORY_LABEL[r.category]}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          STATUS_STYLE[r.status],
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {r.title}
                    </h3>
                    {r.assigneeName && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Assigned to: {r.assigneeName}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        PRIORITY_STYLE[r.priority],
                      )}
                    >
                      {r.priority}
                    </span>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 p-6 w-[480px] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">New Service Request</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="What do you need?"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Provide context and justification…"
                  rows={3}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
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
                {saving ? 'Submitting…' : 'Submit'}
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
