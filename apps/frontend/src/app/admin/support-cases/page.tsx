'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LifeBuoy,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  X,
} from 'lucide-react';
import {
  adminApi,
  type SupportCase,
  type SupportCaseStatus,
  type SupportCasePriority,
  type UpdateSupportCasePayload,
  type CreateSupportCasePayload,
  type TenantSummary,
} from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<SupportCaseStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<SupportCaseStatus, string> = {
  OPEN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_ICONS: Record<SupportCaseStatus, React.ElementType> = {
  OPEN: AlertTriangle,
  IN_PROGRESS: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
};

const PRIORITY_COLORS: Record<SupportCasePriority, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  LOW: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

type FilterStatus = 'ALL' | SupportCaseStatus;

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

export default function SupportCasesPage() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<SupportCasePriority | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listSupportCases(
        filter !== 'ALL' || priorityFilter !== 'ALL'
          ? {
              ...(filter !== 'ALL' && { status: filter }),
              ...(priorityFilter !== 'ALL' && { priority: priorityFilter }),
            }
          : undefined,
      );
      setCases(data);
    } catch {
      setError('Failed to load support cases');
    } finally {
      setLoading(false);
    }
  }, [filter, priorityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = cases.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.tenant.name.toLowerCase().includes(q) ||
      c.submittedByEmail.toLowerCase().includes(q) ||
      c.submittedByName.toLowerCase().includes(q)
    );
  });

  const counts = {
    OPEN: cases.filter((c) => c.status === 'OPEN').length,
    IN_PROGRESS: cases.filter((c) => c.status === 'IN_PROGRESS').length,
    RESOLVED: cases.filter((c) => c.status === 'RESOLVED').length,
    CLOSED: cases.filter((c) => c.status === 'CLOSED').length,
    critical: cases.filter((c) => c.priority === 'CRITICAL' && c.status === 'OPEN').length,
  };

  const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'ALL', label: `All · ${cases.length}` },
    { value: 'OPEN', label: `Open · ${counts.OPEN}` },
    { value: 'IN_PROGRESS', label: `In Progress · ${counts.IN_PROGRESS}` },
    { value: 'RESOLVED', label: `Resolved · ${counts.RESOLVED}` },
    { value: 'CLOSED', label: `Closed · ${counts.CLOSED}` },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Support Cases</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage and respond to customer support requests.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New case
        </button>
      </div>

      {counts.critical > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{counts.critical}</strong> critical open{' '}
            {counts.critical === 1 ? 'case' : 'cases'} require immediate attention
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition-all',
                filter === value
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition-all',
                priorityFilter === p
                  ? 'bg-white/20 text-white'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {p === 'ALL' ? 'Any priority' : p}
            </button>
          ))}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cases…"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 sm:w-52"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <LifeBuoy className="h-12 w-12 opacity-30" />
          <p className="text-sm">No support cases</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sc) => (
            <SupportCaseCard
              key={sc.id}
              sc={sc}
              onRefresh={() => {
                void load();
              }}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── Support case card ─────────────────────────────────────────────────────────

function SupportCaseCard({ sc, onRefresh }: { sc: SupportCase; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateSupportCasePayload>({
    status: sc.status,
    priority: sc.priority,
    assignedToEmail: sc.assignedToEmail ?? '',
    internalNotes: sc.internalNotes ?? '',
    resolutionNotes: sc.resolutionNotes ?? '',
  });

  const StatusIcon = STATUS_ICONS[sc.status];

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await adminApi.updateSupportCase(sc.id, {
        ...form,
        assignedToEmail: form.assignedToEmail || undefined,
        internalNotes: form.internalNotes || undefined,
        resolutionNotes: form.resolutionNotes || undefined,
      });
      onRefresh();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border bg-slate-900/60 overflow-hidden transition-all',
        sc.priority === 'CRITICAL' && sc.status === 'OPEN'
          ? 'border-red-500/30'
          : 'border-white/10',
      )}
    >
      {/* Row */}
      <div className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{sc.title}</h3>
            <span className="text-xs text-slate-500">· {sc.tenant.name}</span>
          </div>
          <p className="text-sm text-slate-400">
            {sc.submittedByName} · {sc.submittedByEmail} ·{' '}
            <span className="text-slate-500">{daysAgo(sc.createdAt)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold uppercase',
              PRIORITY_COLORS[sc.priority],
            )}
          >
            {sc.priority}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
              STATUS_COLORS[sc.status],
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {STATUS_LABEL[sc.status]}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-1">
              Description
            </p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{sc.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <CaseField label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as SupportCaseStatus }))
                  }
                  className="admin-input"
                >
                  {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as SupportCaseStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ),
                  )}
                </select>
              </CaseField>

              <CaseField label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as SupportCasePriority }))
                  }
                  className="admin-input"
                >
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SupportCasePriority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </CaseField>

              <CaseField label="Assigned to (Clarbit email)">
                <input
                  type="email"
                  value={form.assignedToEmail ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToEmail: e.target.value }))}
                  placeholder="agent@clarbit.com"
                  className="admin-input"
                />
              </CaseField>
            </div>

            <div className="space-y-3">
              <CaseField label="Internal notes">
                <textarea
                  rows={3}
                  value={form.internalNotes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
                  placeholder="Internal team notes…"
                  className="admin-input resize-none"
                />
              </CaseField>

              <CaseField label="Resolution notes">
                <textarea
                  rows={3}
                  value={form.resolutionNotes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, resolutionNotes: e.target.value }))}
                  placeholder="What resolved this case…"
                  className="admin-input resize-none"
                />
              </CaseField>
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {saveError}
            </div>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create case modal ─────────────────────────────────────────────────────────

function CreateCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [form, setForm] = useState<CreateSupportCasePayload>({
    tenantId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    submittedByEmail: '',
    submittedByName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listTenants()
      .then(setTenants)
      .catch(() => null);
  }, []);

  const handleCreate = async () => {
    if (
      !form.tenantId ||
      !form.title ||
      !form.description ||
      !form.submittedByEmail ||
      !form.submittedByName
    ) {
      setError('Please fill in all required fields');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.createSupportCase(form);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-white">New support case</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <CaseField label="Tenant *">
            <select
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              className="admin-input"
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </CaseField>

          <CaseField label="Title *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the issue"
              className="admin-input"
            />
          </CaseField>

          <CaseField label="Description *">
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Full details of the support request…"
              className="admin-input resize-none"
            />
          </CaseField>

          <div className="grid grid-cols-2 gap-3">
            <CaseField label="Contact name *">
              <input
                type="text"
                value={form.submittedByName}
                onChange={(e) => setForm((f) => ({ ...f, submittedByName: e.target.value }))}
                placeholder="Alice Smith"
                className="admin-input"
              />
            </CaseField>
            <CaseField label="Contact email *">
              <input
                type="email"
                value={form.submittedByEmail}
                onChange={(e) => setForm((f) => ({ ...f, submittedByEmail: e.target.value }))}
                placeholder="alice@customer.com"
                className="admin-input"
              />
            </CaseField>
          </div>

          <CaseField label="Priority">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value as SupportCasePriority }))
              }
              className="admin-input"
            >
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SupportCasePriority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </CaseField>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create case
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}
