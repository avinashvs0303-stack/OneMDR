'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import {
  Check,
  Zap,
  Building2,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Users,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTenant, type TenantInfo } from '@/lib/auth.api';
import { billingApi, type TargetPlan } from '@/lib/billing.api';

// ── Plan definitions — derived from actual Clarbit modules ────────────────────

type PlanKey = 'FREE' | 'PRO' | 'ENTERPRISE';

interface PlanDef {
  key: PlanKey;
  name: string;
  tagline: string;
  price: string;
  icon: React.ElementType;
  features: string[];
  maxUsers: string;
  integrations: string;
  color: string;
  iconBg: string;
}

const PLANS: PlanDef[] = [
  {
    key: 'FREE',
    name: 'Starter',
    tagline: 'Core DaaS for small security teams.',
    price: 'Included',
    icon: Zap,
    maxUsers: 'Up to 10 users',
    integrations: '1 SIEM integration',
    features: [
      'Global detection library (view-only)',
      'ATT&CK Coverage overview',
      '1 SIEM platform integration',
      'Up to 10 user seats',
      'SOC documentation',
      'Community & email support',
    ],
    color: 'border-black/10 dark:border-white/10',
    iconBg: 'bg-slate-500/10 text-slate-500 dark:text-zinc-400',
  },
  {
    key: 'PRO',
    name: 'Pro',
    tagline: 'Full DaaS + THaaS for scaling SOC teams.',
    price: 'Contact sales',
    icon: Building2,
    maxUsers: 'Up to 100 users',
    integrations: 'Up to 10 SIEM integrations',
    features: [
      'Full detection library — custom + global rules',
      'Detection deployment & SIEM push',
      'ATT&CK Coverage Navigator',
      'Threat Hunt missions, IOC Tracker & Playbooks',
      'SOC roster, incidents, change & service management',
      'AI-assisted detection tuning',
      'CISO, SOC Manager & Detection Analytics dashboards',
      'Secret Vault (encrypted credential store)',
      'Executive Bulletins',
      'Up to 100 user seats',
      'Up to 10 SIEM integrations',
      'Priority support + response SLA',
    ],
    color: 'border-amber-300 dark:border-amber-500/40',
    iconBg: 'bg-amber-600 text-white',
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Full MSSP platform for multi-tenant operations.',
    price: 'Custom',
    icon: Shield,
    maxUsers: 'Unlimited users',
    integrations: 'Unlimited integrations',
    features: [
      'Everything in Pro',
      'MSSP mode — manage multiple client tenants',
      'Dedicated Clarbit detection engineer',
      'Custom detection rule authoring & tuning',
      'Compliance reporting (ISO 27001, SOC 2, NIST, HIPAA)',
      'White-label executive dashboards & reporting',
      'Unlimited user seats',
      'Unlimited SIEM integrations',
      'Custom SLA / SLO',
      'Dedicated Customer Success Manager',
      '24 / 7 emergency response support',
    ],
    color: 'border-blue-300 dark:border-blue-500/40',
    iconBg: 'bg-blue-600 text-white',
  },
];

const PLAN_ORDER: PlanKey[] = ['FREE', 'PRO', 'ENTERPRISE'];

function planIndex(plan: PlanKey) {
  return PLAN_ORDER.indexOf(plan);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────

function UpgradeModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: PlanDef;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await billingApi.submitUpgradeRequest({ targetPlan: plan.key as TargetPlan, reason });
      onSuccess();
    } catch {
      setError('Failed to submit upgrade request. Please try again or contact billing@clarbit.io.');
    } finally {
      setSubmitting(false);
    }
  }

  const Icon = plan.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Request upgrade to {plan.name}
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Your request will be reviewed by the Clarbit team within 1 business day.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4',
            plan.color,
            'bg-black/2 dark:bg-white/2',
          )}
        >
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              plan.iconBg,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{plan.name}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{plan.tagline}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1.5">
            Tell us about your use case <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. We are scaling to 5 SIEM platforms and need hunt mission capabilities across our SOC team…"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PlanDef | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getTenant()
      .then(setTenant)
      .catch(() => setFetchError('Unable to load plan information. Please refresh the page.'))
      .finally(() => setLoadingTenant(false));
  }, []);

  const currentPlanKey = (tenant?.plan ?? 'FREE') as PlanKey;
  const currentPlanDef = PLANS.find((p) => p.key === currentPlanKey) ?? PLANS[0];
  const currentIdx = planIndex(currentPlanKey);

  const isTrialing = !!(tenant?.trialEndsAt && new Date(tenant.trialEndsAt) > new Date());
  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  const licenseExpiry = formatDate(tenant?.licenseExpiresAt);
  const trialExpiry = formatDate(tenant?.trialEndsAt);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Plans & Billing" />

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {successMsg}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                The Clarbit team will review your request and reach out within 1 business day.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="ml-auto rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
            >
              <X className="h-4 w-4 text-emerald-500" />
            </button>
          </div>
        )}

        {/* Fetch error */}
        {fetchError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {/* ── Current plan card ──────────────────────────────────────────── */}
        {loadingTenant ? (
          <div className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-5 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-zinc-400">Loading your plan…</p>
          </div>
        ) : (
          tenant && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/5 backdrop-blur-md px-5 py-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Current plan
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {currentPlanDef.name} · {tenant.name}
                    </p>
                    {isTrialing && (
                      <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-purple-200 dark:border-purple-500/25 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5">
                        Trial
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {tenant._count.users} / {tenant.maxUsers} users
                    </span>
                    {licenseExpiry && !isTrialing && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        License expires {licenseExpiry}
                      </span>
                    )}
                    {isTrialing && trialExpiry && (
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                        <Clock className="h-3 w-3" />
                        Trial ends {trialExpiry} ({trialDaysLeft}d left)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {tenant.licenseModules.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                    Licensed modules
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tenant.licenseModules.map((mod) => (
                      <span
                        key={mod}
                        className="flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-300"
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Plan comparison ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Available plans</h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-5">
            All upgrades are handled by Clarbit. Submit a request and we&apos;ll contact you within
            1 business day.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlanKey;
              const canUpgrade = !loadingTenant && planIndex(plan.key) > currentIdx;
              const isPast = !loadingTenant && planIndex(plan.key) < currentIdx;
              const Icon = plan.icon;

              return (
                <div
                  key={plan.key}
                  className={cn(
                    'relative rounded-xl border backdrop-blur-md p-6 shadow-sm flex flex-col gap-5 transition-all duration-200',
                    isCurrent
                      ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10'
                      : canUpgrade
                        ? cn(
                            'border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:shadow-md cursor-pointer',
                            plan.color,
                          )
                        : isPast
                          ? 'border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 opacity-40 pointer-events-none'
                          : 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5',
                  )}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm shadow-amber-500/30 whitespace-nowrap">
                      Your plan
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        plan.iconBg,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{plan.name}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{plan.tagline}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {plan.price}
                    </span>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {plan.maxUsers}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {plan.integrations}
                      </span>
                    </div>
                  </div>

                  <ul className="flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-xs text-slate-700 dark:text-zinc-300"
                      >
                        <Check
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 mt-0.5',
                            isCurrent
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-500 dark:text-emerald-400',
                          )}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="mt-auto rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-center text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Current plan
                    </div>
                  ) : canUpgrade ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setSuccessMsg(null);
                      }}
                      className={cn(
                        'mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm',
                        plan.key === 'ENTERPRISE'
                          ? 'bg-blue-600 text-white hover:bg-blue-500'
                          : 'bg-amber-600 text-white hover:bg-amber-500 shadow-amber-500/20',
                      )}
                    >
                      Request upgrade <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Info callout ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Billing & plan management
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Plans, seat limits, module entitlements, and license renewals are managed exclusively
              by Clarbit. To discuss pricing or make changes, submit an upgrade request above or
              email{' '}
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                billing@clarbit.io
              </span>
              .
            </p>
          </div>
        </div>
      </main>

      {selectedPlan && (
        <UpgradeModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setSelectedPlan(null);
            setSuccessMsg(
              `Your upgrade request to ${selectedPlan.name} has been submitted successfully.`,
            );
          }}
        />
      )}
    </div>
  );
}
