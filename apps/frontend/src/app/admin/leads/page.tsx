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
  Inbox,
} from 'lucide-react';
import { adminApi, type Lead, type ProvisionLeadPayload } from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const LICENSE_MODULES = ['SIEM', 'HUNT', 'COVERAGE', 'DETECTIONS', 'REPORTS', 'AUTOMATIONS'];
const PLANS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
const TENANT_TYPES = ['STANDARD', 'MSSP'] as const;

type ApiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type FilterStatus = 'ALL' | ApiStatus;

const STATUS_LABEL: Record<ApiStatus, string> = {
  PENDING: 'New',
  APPROVED: 'Provisioned',
  REJECTED: 'Declined',
};

const STATUS_COLORS: Record<ApiStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_ICONS: Record<ApiStatus, React.ElementType> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

function daysOld(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('PENDING');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listLeads(status === 'ALL' ? undefined : status);
      setLeads(data);
    } catch {
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const filtered = leads.filter((r) => {
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
    PENDING: leads.filter((r) => r.status === 'PENDING').length,
    APPROVED: leads.filter((r) => r.status === 'APPROVED').length,
    REJECTED: leads.filter((r) => r.status === 'REJECTED').length,
    unreviewed: leads.filter((r) => r.status === 'PENDING' && daysOld(r.createdAt) > 7).length,
  };

  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: `New - ${counts.PENDING}` },
    { value: 'APPROVED', label: `Provisioned - ${counts.APPROVED}` },
    { value: 'REJECTED', label: `Declined - ${counts.REJECTED}` },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Leads</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Inbound interest from potential customers. Review, qualify, and provision tenants.
        </p>
      </div>

      {counts.unreviewed > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{counts.unreviewed}</strong> lead{counts.unreviewed > 1 ? 's' : ''} unreviewed
            for more than 7 days
          </span>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition-all',
                filter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, email..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-600/40 focus:outline-none focus:ring-1 focus:ring-blue-600/20 sm:w-64"
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
          <Inbox className="h-12 w-12 opacity-30" />
          <p className="text-sm">No leads yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              autoExpand={lead.id === focusId}
              onRefresh={() => void load(filter)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------

function LeadCard({
  lead,
  autoExpand,
  onRefresh,
}: {
  lead: Lead;
  autoExpand: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [provisioning, setProvisioning] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState(false);

  const days = daysOld(lead.createdAt);
  const stale = lead.status === 'PENDING' && days > 7;

  const [provisionForm, setProvisionForm] = useState<ProvisionLeadPayload>({
    planType: 'PRO',
    tenantType: 'STANDARD',
    maxUsers: 25,
    licenseModules: ['DETECTIONS', 'COVERAGE'],
    licenseExpiresAt: '',
    adminNotes: '',
  });
  const [declineReason, setDeclineReason] = useState('');

  const handleProvision = async () => {
    setProvisioning(true);
    setActionError(null);
    try {
      await adminApi.provisionLead(lead.id, {
        ...provisionForm,
        licenseExpiresAt: provisionForm.licenseExpiresAt || undefined,
        adminNotes: provisionForm.adminNotes || undefined,
      });
      setProvisioned(true);
      onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setProvisioning(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      setActionError('Please provide a reason before declining');
      return;
    }
    setDeclining(true);
    setActionError(null);
    try {
      await adminApi.declineLead(lead.id, { rejectionReason: declineReason });
      onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setDeclining(false);
    }
  };

  const toggleModule = (mod: string) =>
    setProvisionForm((p) => ({
      ...p,
      licenseModules: p.licenseModules.includes(mod)
        ? p.licenseModules.filter((m) => m !== mod)
        : [...p.licenseModules, mod],
    }));

  const StatusIcon = STATUS_ICONS[lead.status];

  return (
    <div
      className={cn(
        'rounded-xl border bg-slate-900/60 overflow-hidden transition-all',
        stale ? 'border-amber-500/30' : 'border-white/10',
      )}
    >
      {/* Row */}
      <div className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{lead.companyName}</h3>
            {lead.industry && <span className="text-xs text-slate-500">· {lead.industry}</span>}
            {lead.companySize && (
              <span className="text-xs text-slate-500">· {lead.companySize}</span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {lead.contactName} ·{' '}
            <a
              href={`mailto:${lead.contactEmail}`}
              className="hover:text-blue-400 hover:underline transition-colors"
            >
              {lead.contactEmail}
            </a>
            {lead.website && (
              <>
                {' '}
                ·{' '}
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-blue-400 hover:underline transition-colors"
                >
                  website <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {stale && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {days}d old
            </span>
          )}
          {!stale && lead.status === 'PENDING' && (
            <span className="text-xs text-slate-500">{days === 0 ? 'today' : `${days}d ago`}</span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
              STATUS_COLORS[lead.status],
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {STATUS_LABEL[lead.status]}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-5">
          {lead.useCase && (
            <div className="space-y-1">
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Use case / message
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{lead.useCase}</p>
            </div>
          )}

          {/* Success state after provisioning */}
          {provisioned && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Tenant provisioned</p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  Invite email sent to <strong>{lead.contactEmail}</strong>. They will click the
                  link, set a password, and land directly in their OneMDR workspace.
                </p>
              </div>
            </div>
          )}

          {actionError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {actionError}
            </div>
          )}

          {/* Action panels - new leads only */}
          {lead.status === 'PENDING' && !provisioned && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Provision panel */}
              <div className="rounded-xl border border-white/10 bg-slate-900 p-4 space-y-4">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  Provision tenant
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plan">
                    <select
                      value={provisionForm.planType}
                      onChange={(e) =>
                        setProvisionForm((p) => ({
                          ...p,
                          planType: e.target.value as ProvisionLeadPayload['planType'],
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
                      value={provisionForm.maxUsers}
                      onChange={(e) =>
                        setProvisionForm((p) => ({ ...p, maxUsers: Number(e.target.value) }))
                      }
                      className="admin-input"
                    />
                  </Field>
                </div>

                <Field label="Tenant type">
                  <div className="flex gap-2 mt-1">
                    {TENANT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setProvisionForm((p) => ({
                            ...p,
                            tenantType: t,
                            maxSubTenants: t === 'STANDARD' ? undefined : p.maxSubTenants,
                          }))
                        }
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                          provisionForm.tenantType === t
                            ? 'border-blue-600 bg-blue-600/10 text-blue-300'
                            : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300',
                        )}
                      >
                        {t === 'STANDARD' ? 'Standard' : 'MSSP (multi-tenant)'}
                      </button>
                    ))}
                  </div>
                  {provisionForm.tenantType === 'MSSP' && (
                    <div className="mt-2">
                      <label className="text-[10px] text-slate-500">
                        Max sub-tenants (blank = unlimited)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={provisionForm.maxSubTenants ?? ''}
                        onChange={(e) =>
                          setProvisionForm((p) => ({
                            ...p,
                            maxSubTenants: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                        className="admin-input mt-1"
                      />
                    </div>
                  )}
                </Field>

                <Field label="Modules">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {LICENSE_MODULES.map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleModule(mod)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all',
                          provisionForm.licenseModules.includes(mod)
                            ? 'border-blue-600 bg-blue-600/10 text-blue-300'
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
                    value={provisionForm.licenseExpiresAt?.slice(0, 10) ?? ''}
                    onChange={(e) =>
                      setProvisionForm((p) => ({
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
                    value={provisionForm.adminNotes ?? ''}
                    onChange={(e) =>
                      setProvisionForm((p) => ({ ...p, adminNotes: e.target.value }))
                    }
                    className="admin-input resize-none"
                  />
                </Field>

                <button
                  onClick={() => void handleProvision()}
                  disabled={provisioning || provisionForm.licenseModules.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {provisioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Provision tenant & send invite
                </button>
              </div>

              {/* Decline panel */}
              <div className="rounded-xl border border-white/10 bg-slate-900 p-4 space-y-4">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                  Decline lead
                </p>

                <Field label="Reason (shared with the contact)">
                  <textarea
                    rows={5}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Thank you for your interest in OneMDR. We're not able to onboard your organisation at this time..."
                    className="admin-input resize-none"
                  />
                </Field>

                <button
                  onClick={() => void handleDecline()}
                  disabled={declining || !declineReason.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {declining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Decline lead
                </button>
              </div>
            </div>
          )}

          {/* Provisioned summary */}
          {lead.status === 'APPROVED' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Plan" value={lead.planType} />
              <Stat label="Type" value={lead.tenantType ?? 'STANDARD'} />
              <Stat label="Seat limit" value={String(lead.maxUsers)} />
              <Stat label="Modules" value={lead.licenseModules.join(', ') || '-'} />
              <Stat
                label="License expires"
                value={
                  lead.licenseExpiresAt
                    ? new Date(lead.licenseExpiresAt).toLocaleDateString()
                    : 'No expiry'
                }
              />
              {lead.adminNotes && (
                <div className="col-span-2 sm:col-span-4">
                  <Stat label="Notes" value={lead.adminNotes} />
                </div>
              )}
            </div>
          )}

          {/* Declined summary */}
          {lead.status === 'REJECTED' && lead.rejectionReason && (
            <div className="space-y-1">
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                Decline reason
              </p>
              <p className="text-sm text-slate-300">{lead.rejectionReason}</p>
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
