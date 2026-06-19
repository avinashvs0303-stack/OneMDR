'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  AlertTriangle,
  ExternalLink,
  Mail,
} from 'lucide-react';
import {
  tenantRequestsApi,
  type TenantRequest,
  type ApprovePayload,
} from '@/lib/tenant-requests.api';
import { cn } from '@/lib/utils';

const LICENSE_MODULES = ['SIEM', 'HUNT', 'COVERAGE', 'DETECTIONS', 'REPORTS', 'AUTOMATIONS'];
const PLANS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

function daysPending(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
}

function RequestsContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');

  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await tenantRequestsApi.list(status === 'ALL' ? undefined : status);
      setRequests(res.data);
    } catch {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.companyName.toLowerCase().includes(q) ||
      r.contactEmail.toLowerCase().includes(q) ||
      r.contactName.toLowerCase().includes(q) ||
      (r.industry?.toLowerCase().includes(q) ?? false)
    );
  });

  const counts = {
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
    overdue: requests.filter((r) => r.status === 'PENDING' && daysPending(r.createdAt) > 7).length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Access Requests</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Review inbound onboarding requests, set license terms, and approve or reject.
        </p>
      </div>

      {counts.overdue > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{counts.overdue}</strong> request{counts.overdue > 1 ? 's' : ''} overdue
            (pending &gt;7 days)
          </span>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest uppercase transition-all',
                filter === s
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              {s}
              {s !== 'ALL' && ` · ${counts[s] ?? 0}`}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, email…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 sm:w-64"
          />
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
          <Clock className="h-12 w-12 opacity-30" />
          <p className="text-sm">No {filter !== 'ALL' ? filter.toLowerCase() : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              autoExpand={req.id === focusId}
              onRefresh={() => void load(filter)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsContent />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RequestCard({
  request,
  autoExpand,
  onRefresh,
}: {
  request: TenantRequest;
  autoExpand: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const days = daysPending(request.createdAt);
  const overdue = request.status === 'PENDING' && days > 7;

  const [approveForm, setApproveForm] = useState<ApprovePayload>({
    planType: 'PRO',
    maxUsers: 25,
    licenseModules: ['DETECTIONS', 'COVERAGE'],
    licenseExpiresAt: '',
    adminNotes: '',
  });
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    setApproving(true);
    setActionError(null);
    try {
      await tenantRequestsApi.approve(request.id, {
        ...approveForm,
        licenseExpiresAt: approveForm.licenseExpiresAt || undefined,
        adminNotes: approveForm.adminNotes || undefined,
      });
      setInviteSent(true);
      onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setRejecting(true);
    setActionError(null);
    try {
      await tenantRequestsApi.reject(request.id, { rejectionReason: rejectReason });
      onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const toggleModule = (mod: string) =>
    setApproveForm((p) => ({
      ...p,
      licenseModules: p.licenseModules.includes(mod)
        ? p.licenseModules.filter((m) => m !== mod)
        : [...p.licenseModules, mod],
    }));

  const statusConfig = {
    PENDING: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    APPROVED: {
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: CheckCircle2,
    },
    REJECTED: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  }[request.status];

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        'rounded-xl border bg-slate-900/60 overflow-hidden transition-all',
        overdue ? 'border-red-500/30' : 'border-white/10',
      )}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{request.companyName}</h3>
            {request.industry && (
              <span className="text-xs text-slate-500">· {request.industry}</span>
            )}
            {request.companySize && (
              <span className="text-xs text-slate-500">· {request.companySize}</span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {request.contactName} ·{' '}
            <a
              href={`mailto:${request.contactEmail}`}
              className="hover:text-amber-400 hover:underline transition-colors"
            >
              {request.contactEmail}
            </a>
            {request.website && (
              <>
                {' '}
                ·{' '}
                <a
                  href={request.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-amber-400 hover:underline transition-colors"
                >
                  website <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {overdue && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
              {days}d overdue
            </span>
          )}
          {!overdue && request.status === 'PENDING' && (
            <span className="text-xs text-slate-500">{days === 0 ? 'today' : `${days}d ago`}</span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
              statusConfig.color,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {request.status}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-5">
          {/* Use case */}
          {request.useCase && (
            <div className="space-y-1">
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Use case
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{request.useCase}</p>
            </div>
          )}

          {/* Invite sent confirmation (replaces old tempPassword) */}
          {inviteSent && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Tenant created</p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  Invite email sent to <strong>{request.contactEmail}</strong> via Supabase. They
                  will click the link, set a password, and be taken directly into the app.
                </p>
              </div>
            </div>
          )}

          {actionError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {actionError}
            </div>
          )}

          {/* Actions — PENDING only */}
          {request.status === 'PENDING' && !inviteSent && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Approve panel */}
              <div className="rounded-xl border border-white/10 bg-slate-900 p-4 space-y-4">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  Approve & configure license
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plan">
                    <select
                      value={approveForm.planType}
                      onChange={(e) =>
                        setApproveForm((p) => ({
                          ...p,
                          planType: e.target.value as ApprovePayload['planType'],
                        }))
                      }
                      className="admin-input"
                    >
                      {PLANS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Seat limit">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={approveForm.maxUsers}
                      onChange={(e) =>
                        setApproveForm((p) => ({ ...p, maxUsers: Number(e.target.value) }))
                      }
                      className="admin-input"
                    />
                  </Field>
                </div>

                <Field label="Modules">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {LICENSE_MODULES.map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleModule(mod)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all',
                          approveForm.licenseModules.includes(mod)
                            ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                            : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300',
                        )}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="License expires (optional)">
                  <input
                    type="date"
                    value={approveForm.licenseExpiresAt?.slice(0, 10) ?? ''}
                    onChange={(e) =>
                      setApproveForm((p) => ({
                        ...p,
                        licenseExpiresAt: e.target.value ? `${e.target.value}T23:59:59Z` : '',
                      }))
                    }
                    className="admin-input"
                  />
                </Field>

                <Field label="Internal notes">
                  <textarea
                    rows={2}
                    value={approveForm.adminNotes ?? ''}
                    onChange={(e) => setApproveForm((p) => ({ ...p, adminNotes: e.target.value }))}
                    className="admin-input resize-none"
                  />
                </Field>

                <button
                  onClick={() => void handleApprove()}
                  disabled={approving || approveForm.licenseModules.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve & send invite
                </button>
              </div>

              {/* Reject panel */}
              <div className="rounded-xl border border-white/10 bg-slate-900 p-4 space-y-4">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  Reject application
                </p>

                <Field label="Reason shown to applicant">
                  <textarea
                    rows={5}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Thank you for your interest. Unfortunately we are not able to onboard your organisation at this time…"
                    className="admin-input resize-none"
                  />
                </Field>

                <button
                  onClick={() => void handleReject()}
                  disabled={rejecting || !rejectReason.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject application
                </button>
              </div>
            </div>
          )}

          {/* Approved summary */}
          {request.status === 'APPROVED' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Plan" value={request.planType} />
              <Stat label="Seat limit" value={String(request.maxUsers)} />
              <Stat label="Modules" value={request.licenseModules.join(', ') || '—'} />
              <Stat
                label="Expires"
                value={
                  request.licenseExpiresAt
                    ? new Date(request.licenseExpiresAt).toLocaleDateString()
                    : 'Never'
                }
              />
            </div>
          )}

          {/* Rejected summary */}
          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="space-y-1">
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Rejection reason
              </p>
              <p className="text-sm text-slate-300">{request.rejectionReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">{label}</p>
      <p className="text-sm font-medium text-white truncate">{value}</p>
    </div>
  );
}
