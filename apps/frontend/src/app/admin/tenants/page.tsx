'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Building2,
  Users,
  ChevronRight,
  Loader2,
  Key,
  AlertTriangle,
  Plus,
  X,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import {
  adminApi,
  type TenantSummary,
  type TenantPlan,
  type TenantType,
  type CreateTenantPayload,
} from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const LICENSE_MODULES = ['SIEM', 'HUNT', 'COVERAGE', 'DETECTIONS', 'REPORTS', 'AUTOMATIONS'];
const PLANS = ['FREE', 'PRO', 'ENTERPRISE'] as const;
const TENANT_TYPES = ['STANDARD', 'MSSP'] as const;

const PLAN_COLORS: Record<TenantPlan, string> = {
  FREE: 'bg-slate-500/20 text-slate-400',
  PRO: 'bg-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400',
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400_000);
}

const EMPTY_FORM: CreateTenantPayload = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  planType: 'PRO',
  tenantType: 'STANDARD',
  maxUsers: 25,
  licenseModules: ['DETECTIONS', 'COVERAGE'],
  licenseExpiresAt: '',
  adminNotes: '',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');

  // New tenant modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateTenantPayload>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; email: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(
        await adminApi.listTenants({
          search: search || undefined,
          plan: plan || undefined,
          status: status || undefined,
        }),
      );
    } catch {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [search, plan, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleModule = (mod: string) =>
    setForm((p) => ({
      ...p,
      licenseModules: p.licenseModules.includes(mod)
        ? p.licenseModules.filter((m) => m !== mod)
        : [...p.licenseModules, mod],
    }));

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await adminApi.createTenant({
        ...form,
        licenseExpiresAt: form.licenseExpiresAt || undefined,
        adminNotes: form.adminNotes || undefined,
      });
      setCreated({ slug: res.slug, email: form.contactEmail });
      void load();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setCreateError(null);
    setCreated(null);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Tenants</h1>
          <p className="text-sm text-slate-400 mt-0.5">All provisioned customer organisations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-600/40 focus:outline-none focus:ring-1 focus:ring-blue-600/20 sm:w-56"
          />
        </div>

        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600/20"
        >
          <option value="">All plans</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-900 py-1.5 px-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600/20"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        <p className="sm:ml-auto text-xs text-slate-500">
          {loading ? '...' : `${tenants.length} result${tenants.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <Building2 className="h-12 w-12 opacity-30" />
          <p className="text-sm">No tenants found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/80 text-[10px] font-black tracking-widest uppercase text-slate-500">
                {[
                  'Organisation',
                  'Plan',
                  'Type',
                  'Users',
                  'Modules',
                  'License expires',
                  'Status',
                  '',
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tenants.map((t) => {
                const expiresIn = t.licenseExpiresAt ? daysUntil(t.licenseExpiresAt) : null;
                const expiringSoon = expiresIn !== null && expiresIn <= 30;

                return (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0',
                            t.isActive ? 'bg-emerald-400' : 'bg-slate-500',
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{t.name}</p>
                          <p className="text-xs text-slate-500">{t.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          PLAN_COLORS[t.plan],
                        )}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          t.tenantType === 'MSSP'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-slate-500/15 text-slate-400',
                        )}
                      >
                        {t.tenantType ?? 'STANDARD'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Users className="h-3 w-3 text-slate-500" />
                        {t._count.users}
                        <span className="text-slate-600">/ {t.maxUsers}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.licenseModules.slice(0, 3).map((m) => (
                          <span
                            key={m}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                          >
                            {m}
                          </span>
                        ))}
                        {t.licenseModules.length > 3 && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                            +{t.licenseModules.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.licenseExpiresAt ? (
                        <span
                          className={cn(
                            'flex items-center gap-1 text-xs',
                            expiringSoon ? 'text-amber-400' : 'text-slate-400',
                          )}
                        >
                          {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                          {new Date(t.licenseExpiresAt).toLocaleDateString()}
                          {expiringSoon && <span className="text-[10px]">({expiresIn}d)</span>}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Key className="h-3 w-3" /> No expiry
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          t.isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400',
                        )}
                      >
                        {t.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-blue-600/30 hover:text-blue-400 transition-all"
                      >
                        Manage <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">Create tenant</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manually provision a tenant and send invite to the owner
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success state */}
            {created ? (
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Tenant created</p>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      Invite sent to <strong>{created.email}</strong>. Slug:{' '}
                      <strong>{created.slug}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" /> Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {createError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                    {createError}
                  </div>
                )}

                {/* Company + contact */}
                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="Company name" className="col-span-2">
                    <input
                      className="admin-input"
                      placeholder="Acme Corp"
                      value={form.companyName}
                      onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                    />
                  </ModalField>
                  <ModalField label="Contact name">
                    <input
                      className="admin-input"
                      placeholder="John Smith"
                      value={form.contactName}
                      onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                    />
                  </ModalField>
                  <ModalField label="Contact email">
                    <input
                      type="email"
                      className="admin-input"
                      placeholder="john@acme.com"
                      value={form.contactEmail}
                      onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                    />
                  </ModalField>
                </div>

                {/* Plan + seats */}
                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="Plan">
                    <select
                      className="admin-input"
                      value={form.planType}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, planType: e.target.value as TenantPlan }))
                      }
                    >
                      {PLANS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </ModalField>
                  <ModalField label="Seat limit">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      className="admin-input"
                      value={form.maxUsers}
                      onChange={(e) => setForm((p) => ({ ...p, maxUsers: Number(e.target.value) }))}
                    />
                  </ModalField>
                </div>

                {/* Tenant type */}
                <ModalField label="Tenant type">
                  <div className="flex gap-2 mt-1">
                    {TENANT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            tenantType: t as TenantType,
                            maxSubTenants: t === 'STANDARD' ? undefined : p.maxSubTenants,
                          }))
                        }
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                          form.tenantType === t
                            ? 'border-blue-600 bg-blue-600/10 text-blue-300'
                            : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300',
                        )}
                      >
                        {t === 'STANDARD' ? 'Standard' : 'MSSP (multi-tenant)'}
                      </button>
                    ))}
                  </div>
                  {form.tenantType === 'MSSP' && (
                    <div className="mt-2">
                      <label className="text-[10px] text-slate-500">
                        Max sub-tenants (blank = unlimited)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        className="admin-input mt-1"
                        value={form.maxSubTenants ?? ''}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            maxSubTenants: e.target.value ? Number(e.target.value) : undefined,
                          }))
                        }
                      />
                    </div>
                  )}
                </ModalField>

                {/* Modules */}
                <ModalField label="Modules">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {LICENSE_MODULES.map((mod) => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleModule(mod)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all',
                          form.licenseModules.includes(mod)
                            ? 'border-blue-600 bg-blue-600/10 text-blue-300'
                            : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300',
                        )}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </ModalField>

                {/* Expiry + notes */}
                <ModalField label="License expires (optional)">
                  <input
                    type="date"
                    className="admin-input"
                    value={form.licenseExpiresAt?.slice(0, 10) ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        licenseExpiresAt: e.target.value ? `${e.target.value}T23:59:59Z` : '',
                      }))
                    }
                  />
                </ModalField>

                <ModalField label="Internal notes (optional)">
                  <textarea
                    rows={2}
                    className="admin-input resize-none"
                    value={form.adminNotes ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, adminNotes: e.target.value }))}
                  />
                </ModalField>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleCreate()}
                    disabled={
                      creating ||
                      !form.companyName.trim() ||
                      !form.contactName.trim() ||
                      !form.contactEmail.trim() ||
                      form.licenseModules.length === 0
                    }
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create & send invite
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}
