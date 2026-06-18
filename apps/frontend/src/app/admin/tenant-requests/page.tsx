'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  tenantRequestsApi,
  type TenantRequest,
  type ApprovePayload,
} from '@/lib/tenant-requests.api';
import { cn } from '@/lib/utils';

const LICENSE_MODULES = ['SIEM', 'HUNT', 'COVERAGE', 'DETECTIONS', 'REPORTS', 'AUTOMATIONS'];
const PLANS = ['FREE', 'PRO', 'ENTERPRISE'] as const;

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function TenantRequestsPage() {
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (status: FilterStatus) => {
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
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const counts = {
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tenant requests</h1>
          <p className="text-sm text-muted-foreground">
            Review inbound access applications, set license details, and approve or reject.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-black tracking-widest uppercase transition-all',
                filter === s
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {s}
              {s !== 'ALL' && ` · ${counts[s] ?? 0}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Clock className="h-12 w-12 opacity-30" />
            <p className="text-sm">No {filter !== 'ALL' ? filter.toLowerCase() : ''} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onRefresh={() => {
                  void load(filter);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ request, onRefresh }: { request: TenantRequest; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvedResult, setApprovedResult] = useState<{ tempPassword: string } | null>(null);

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
      const res = await tenantRequestsApi.approve(request.id, {
        ...approveForm,
        licenseExpiresAt: approveForm.licenseExpiresAt || undefined,
        adminNotes: approveForm.adminNotes || undefined,
      });
      setApprovedResult({ tempPassword: res.data.tempPassword });
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

  const toggleModule = (mod: string) => {
    setApproveForm((prev) => ({
      ...prev,
      licenseModules: prev.licenseModules.includes(mod)
        ? prev.licenseModules.filter((m) => m !== mod)
        : [...prev.licenseModules, mod],
    }));
  };

  const statusBadge = {
    PENDING: {
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      icon: Clock,
    },
    APPROVED: {
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      icon: CheckCircle2,
    },
    REJECTED: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: XCircle,
    },
  }[request.status];

  const StatusIcon = statusBadge.icon;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{request.companyName}</h3>
            {request.industry && (
              <span className="text-xs text-muted-foreground">· {request.industry}</span>
            )}
            {request.companySize && (
              <span className="text-xs text-muted-foreground">· {request.companySize} people</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {request.contactName} ·{' '}
            <a href={`mailto:${request.contactEmail}`} className="hover:underline">
              {request.contactEmail}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            Submitted{' '}
            {new Date(request.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              statusBadge.color,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {request.status}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-6">
          {/* Use case */}
          {request.useCase && (
            <div className="space-y-1">
              <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                Use case
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{request.useCase}</p>
            </div>
          )}

          {/* Already approved result */}
          {approvedResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-2">
                Tenant created successfully
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-500 mb-1">
                Share this temporary password securely with <strong>{request.contactEmail}</strong>:
              </p>
              <code className="block rounded bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 text-sm font-mono text-emerald-900 dark:text-emerald-300 select-all">
                {approvedResult.tempPassword}
              </code>
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">
                This password is shown once. The user should reset it on first login.
              </p>
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400">
              {actionError}
            </div>
          )}

          {/* Actions — only for PENDING */}
          {request.status === 'PENDING' && !approvedResult && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Approve panel */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                  Approve & set license
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Plan</label>
                    <select
                      value={approveForm.planType}
                      onChange={(e) =>
                        setApproveForm((p) => ({
                          ...p,
                          planType: e.target.value as ApprovePayload['planType'],
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {PLANS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max users</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={approveForm.maxUsers}
                      onChange={(e) =>
                        setApproveForm((p) => ({ ...p, maxUsers: Number(e.target.value) }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Modules</label>
                  <div className="flex flex-wrap gap-1.5">
                    {LICENSE_MODULES.map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleModule(mod)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold border transition-all',
                          approveForm.licenseModules.includes(mod)
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'border-border text-muted-foreground hover:border-amber-500',
                        )}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">License expires (optional)</label>
                  <input
                    type="date"
                    value={
                      approveForm.licenseExpiresAt ? approveForm.licenseExpiresAt.slice(0, 10) : ''
                    }
                    onChange={(e) =>
                      setApproveForm((p) => ({
                        ...p,
                        licenseExpiresAt: e.target.value ? `${e.target.value}T23:59:59Z` : '',
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Admin notes (internal)</label>
                  <textarea
                    rows={2}
                    value={approveForm.adminNotes ?? ''}
                    onChange={(e) => setApproveForm((p) => ({ ...p, adminNotes: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <button
                  onClick={() => {
                    void handleApprove();
                  }}
                  disabled={approving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve & create tenant
                </button>
              </div>

              {/* Reject panel */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                  Reject
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Reason (shown to applicant)</label>
                  <textarea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Thank you for your interest. Unfortunately we are not onboarding new customers in your region at this time."
                    className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <button
                  onClick={() => {
                    void handleReject();
                  }}
                  disabled={rejecting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
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

          {/* Approved details */}
          {request.status === 'APPROVED' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Plan" value={request.planType} />
              <Stat label="Max users" value={String(request.maxUsers)} />
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

          {/* Rejected details */}
          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="space-y-1">
              <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">
                Rejection reason
              </p>
              <p className="text-sm text-foreground">{request.rejectionReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-black tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}
