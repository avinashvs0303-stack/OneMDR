'use client';

import { Header } from '@/components/layout/header';
import { Check, Zap, Building2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Starter', price: '$0', period: '/month',
    description: 'For individuals and small teams getting started.',
    features: ['Up to 3 boards', '5 members', '1 automation', 'Basic analytics', 'Email support'],
    cta: 'Current plan', current: false, highlight: false, icon: Zap,
  },
  {
    name: 'Pro', price: '$12', period: '/user/month',
    description: 'For growing teams that need more power and flexibility.',
    features: ['Unlimited boards', 'Unlimited members', '25 automations', 'Advanced analytics', 'Priority support', 'Custom fields', 'Time tracking'],
    cta: 'Upgrade to Pro', current: true, highlight: true, icon: Building2,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    description: 'For large organizations with advanced security and compliance needs.',
    features: ['Everything in Pro', 'SSO / SAML', 'Advanced RBAC', 'Audit logs', 'Custom SLA', 'Dedicated CSM', 'HIPAA / SOC 2'],
    cta: 'Contact sales', current: false, highlight: false, icon: Shield,
  },
];

export default function BillingPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Plans & Billing" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        <div className="flex items-center justify-between rounded-xl border border-blue-200 dark:border-blue-500/25 bg-blue-50 dark:bg-blue-500/5 backdrop-blur-md px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Current plan</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">Pro · Demo Corp</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">9 members · renews 1 Jul 2026</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">$108</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">/month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={cn(
                  'relative rounded-xl border backdrop-blur-md p-6 shadow-sm dark:shadow-lg flex flex-col gap-5',
                  plan.highlight
                    ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-500/10'
                    : 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5',
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm shadow-blue-500/30">
                    Your plan
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', plan.highlight ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{plan.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{plan.description}</p>
                  </div>
                </div>

                <div>
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500 dark:text-zinc-400">{plan.period}</span>
                </div>

                <ul className="flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300">
                      <Check className={cn('h-3.5 w-3.5 shrink-0', plan.highlight ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-500 dark:text-emerald-400')} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={cn(
                    'mt-auto rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-500/20'
                      : 'border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-700 dark:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10',
                  )}
                >
                  {plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
          <div className="border-b border-black/10 dark:border-white/10 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Billing history</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20">
                {['Date', 'Description', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {['Jun 2026', 'May 2026', 'Apr 2026'].map((month) => (
                <tr key={month} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-900 dark:text-white">1 {month}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">Pro plan · 9 seats</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">$108.00</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Paid
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
