'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Users,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserPlus,
  Trash2,
  Save,
} from 'lucide-react';
import {
  adminApi,
  type TenantDetail,
  type UpdateLicensePayload,
  type TenantPlan,
} from '@/lib/admin.api';
import { cn } from '@/lib/utils';

const LICENSE_MODULES = ['SIEM', 'HUNT', 'COVERAGE', 'DETECTIONS', 'REPORTS', 'AUTOMATIONS'];
const PLANS: TenantPlan[] = ['FREE', 'PRO', 'ENTERPRISE'];

const PLAN_COLORS: Record<TenantPlan, string> = {
  FREE: 'bg-slate-500/20 text-slate-400',
  PRO: 'bg-violet-500/20 text-violet-400',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-amber-500/20 text-amber-400',
  ADMIN: 'bg-violet-500/20 text-violet-400',
  MEMBER: 'bg-slate-500/20 text-slate-400',
  GUEST: 'bg-slate-600/20 text-slate-500',
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400_000);
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // License edit
  const [licenseForm, setLicenseForm] = useState<UpdateLicensePayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Suspend/reactivate
  const [suspending, setSuspending] = useState(false);

  // Invite user
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    name: string;
    role: 'ADMIN' | 'MEMBER' | 'GUEST';
  }>({ email: '', name: '', role: 'MEMBER' });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getTenant(id);
      setTenant(data);
      setLicenseForm({
        planType: data.plan,
        maxUsers: data.maxUsers,
        licenseModules: [...data.licenseModules],
        licenseExpiresAt: data.licenseExpiresAt ?? undefined,
      });
    } catch {
      setError('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const handleSaveLicense = async () => {
    if (!licenseForm) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminApi.updateLicense(id, licenseForm);
      setSaveMsg('License updated');
      void load();
    } catch {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!tenant) return;
    if (!confirm(`Suspend "${tenant.name}"? All users will be blocked from logging in.`)) return;
    setSuspending(true);
    try {
      if (tenant.isActive) await adminApi.suspendTenant(id);
      else await adminApi.reactivateTenant(id);
      void load();
    } catch {
      /* noop */
    } finally {
      setSuspending(false);
    }
  };

  const handleDeactivateUser = async (userId: string, email: string) => {
    if (!confirm(`Deactivate ${email}? Their session will be revoked immediately.`)) return;
    try {
      await adminApi.deactivateUser(id, userId);
      void load();
    } catch {
      /* noop */
    }
  };

  const handleInvite = async () => {
    setInviteError(null);
    setInviteMsg(null);
    if (!inviteForm.email || !inviteForm.name) {
      setInviteError('Email and name are required');
      return;
    }
    setInviting(true);
    try {
      await adminApi.inviteUser(id, inviteForm);
      setInviteMsg(`Invite sent to ${inviteForm.email}`);
      setInviteForm({ email: '', name: '', role: 'MEMBER' });
      setShowInvite(false);
      void load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const toggleModule = (mod: string) => {
    if (!licenseForm) return;
    setLicenseForm((p) =>
      p
        ? {
            ...p,
            licenseModules: p.licenseModules.includes(mod)
              ? p.licenseModules.filter((m) => m !== mod)
              : [...p.licenseModules, mod],
          }
        : p,
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error ?? 'Tenant not found'}
        </div>
      </div>
    );
  }

  const expiresIn = tenant.licenseExpiresAt ? daysUntil(tenant.licenseExpiresAt) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb + header */}
      <div className="space-y-3">
        <Link
          href="/admin/tenants"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All tenants
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  tenant.isActive ? 'bg-emerald-400' : 'bg-slate-500',
                )}
              />
              <h1 className="text-xl font-bold text-white">{tenant.name}</h1>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                  PLAN_COLORS[tenant.plan],
                )}
              >
                {tenant.plan}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {tenant.slug} · Created {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </div>

          <button
            onClick={() => void handleSuspend()}
            disabled={suspending}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              tenant.isActive
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
            )}
          >
            {suspending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : tenant.isActive ? (
              <XCircle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {tenant.isActive ? 'Suspend tenant' : 'Reactivate tenant'}
          </button>
        </div>
      </div>

      {/* License expiry warning */}
      {expiresIn !== null && expiresIn <= 30 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            License expires in <strong>{expiresIn} days</strong> (
            {new Date(tenant.licenseExpiresAt!).toLocaleDateString()}). Consider renewing.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── License editor (left, 3 cols) ─────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">License</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Plan</label>
                <select
                  value={licenseForm?.planType ?? tenant.plan}
                  onChange={(e) =>
                    setLicenseForm((p) =>
                      p ? { ...p, planType: e.target.value as TenantPlan } : p,
                    )
                  }
                  className="admin-input"
                >
                  {PLANS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Seat limit</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={licenseForm?.maxUsers ?? tenant.maxUsers}
                  onChange={(e) =>
                    setLicenseForm((p) => (p ? { ...p, maxUsers: Number(e.target.value) } : p))
                  }
                  className="admin-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Modules</label>
              <div className="flex flex-wrap gap-1.5">
                {LICENSE_MODULES.map((mod) => {
                  const active = licenseForm?.licenseModules.includes(mod) ?? false;
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleModule(mod)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all',
                        active
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300',
                      )}
                    >
                      {mod}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">License expiry</label>
              <input
                type="date"
                value={licenseForm?.licenseExpiresAt?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setLicenseForm((p) =>
                    p
                      ? {
                          ...p,
                          licenseExpiresAt: e.target.value
                            ? `${e.target.value}T23:59:59Z`
                            : undefined,
                        }
                      : p,
                  )
                }
                className="admin-input"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleSaveLicense()}
                disabled={saving || !licenseForm}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save license
              </button>
              {saveMsg && (
                <span
                  className={cn(
                    'text-xs',
                    saveMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400',
                  )}
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* Context from the original request */}
          {tenant.tenantRequest && (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Onboarding details</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Industry', tenant.tenantRequest.industry],
                  ['Company size', tenant.tenantRequest.companySize],
                  ['Website', tenant.tenantRequest.website],
                  ['Phone', tenant.tenantRequest.contactPhone],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="text-slate-500 uppercase font-black tracking-widest text-[10px]">
                        {label}
                      </p>
                      <p className="text-slate-300 mt-0.5">{value}</p>
                    </div>
                  ))}
                {tenant.tenantRequest.useCase && (
                  <div className="col-span-2">
                    <p className="text-slate-500 uppercase font-black tracking-widest text-[10px]">
                      Use case
                    </p>
                    <p className="text-slate-300 mt-0.5 whitespace-pre-wrap">
                      {tenant.tenantRequest.useCase}
                    </p>
                  </div>
                )}
                {tenant.tenantRequest.adminNotes && (
                  <div className="col-span-2">
                    <p className="text-slate-500 uppercase font-black tracking-widest text-[10px]">
                      Admin notes
                    </p>
                    <p className="text-slate-300 mt-0.5">{tenant.tenantRequest.adminNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Users panel (right, 2 cols) ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white">
                  Users{' '}
                  <span className="text-slate-500 font-normal">
                    {tenant.users.length}/{tenant.maxUsers}
                  </span>
                </h2>
              </div>
              <button
                onClick={() => setShowInvite((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-amber-500/30 hover:text-amber-400 transition-all"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </button>
            </div>

            {/* Invite form */}
            {showInvite && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
                <p className="text-[10px] font-black tracking-widest uppercase text-amber-500">
                  Invite new user
                </p>
                <input
                  type="email"
                  placeholder="Email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  className="admin-input"
                />
                <input
                  placeholder="Full name"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                  className="admin-input"
                />
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((p) => ({
                      ...p,
                      role: e.target.value as 'ADMIN' | 'MEMBER' | 'GUEST',
                    }))
                  }
                  className="admin-input"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="GUEST">GUEST</option>
                </select>
                {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
                {inviteMsg && <p className="text-xs text-emerald-400">{inviteMsg}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleInvite()}
                    disabled={inviting}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  >
                    {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Send invite
                  </button>
                  <button
                    onClick={() => setShowInvite(false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* User list */}
            <ul className="space-y-1.5">
              {tenant.users.map((u) => (
                <li
                  key={u.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2.5 gap-2',
                    u.isActive
                      ? 'border-white/5 bg-white/5'
                      : 'border-white/5 bg-slate-800/40 opacity-50',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-white truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          ROLE_COLORS[u.role] ?? ROLE_COLORS['MEMBER'],
                        )}
                      >
                        {u.role}
                      </span>
                      {u.mfaEnabled && (
                        <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                    {u.lastLoginAt && (
                      <p className="text-[10px] text-slate-600">
                        Last login: {new Date(u.lastLoginAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {u.role !== 'OWNER' && u.isActive && (
                    <button
                      onClick={() => void handleDeactivateUser(u.id, u.email)}
                      title="Deactivate user"
                      className="shrink-0 rounded p-1 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
