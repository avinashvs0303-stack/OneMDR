'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/store/auth.store';
import { Header } from '@/components/layout/header';
import {
  ShieldCheck,
  Crosshair,
  BarChart3,
  Layers,
  Zap,
  FileText,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  name: string;
  abbr: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  iconBg: string;
  active: boolean;
  badge?: string;
}

const MODULES: Module[] = [
  {
    id: 'daas',
    name: 'Detection as a Service',
    abbr: 'DaaS',
    description:
      'MITRE ATT&CK-mapped detection engineering. Deploy, tune, and monitor rules across every SIEM in your stack.',
    icon: ShieldCheck,
    href: '/dashboard',
    color: 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-500/10',
    iconBg: 'bg-amber-500/10 text-amber-400',
    active: true,
    badge: 'Active',
  },
  {
    id: 'thaas',
    name: 'Threat Hunting as a Service',
    abbr: 'THaaS',
    description:
      'Proactive threat hunts led by expert analysts. Hypothesis-driven investigation across your log sources.',
    icon: Crosshair,
    href: '/hunt',
    color: 'border-border opacity-60',
    iconBg: 'bg-slate-500/10 text-slate-400',
    active: false,
    badge: 'Coming Soon',
  },
  {
    id: 'caas',
    name: 'Coverage as a Service',
    abbr: 'CaaS',
    description:
      'Continuous ATT&CK coverage gap analysis. Know exactly where your defenses are strong and where they need work.',
    icon: Layers,
    href: '/coverage',
    color: 'border-border opacity-60',
    iconBg: 'bg-slate-500/10 text-slate-400',
    active: false,
    badge: 'Coming Soon',
  },
  {
    id: 'siem',
    name: 'SIEM as a Service',
    abbr: 'SIEMaaS',
    description:
      'Managed SIEM operations. Ingestion health, pipeline monitoring, and log source onboarding managed for you.',
    icon: BarChart3,
    href: '/siem',
    color: 'border-border opacity-60',
    iconBg: 'bg-slate-500/10 text-slate-400',
    active: false,
    badge: 'Coming Soon',
  },
  {
    id: 'automation',
    name: 'Automation as a Service',
    abbr: 'AaaS',
    description:
      'Playbook-driven SOC automation. Route alerts, enrich indicators, and close tickets without human intervention.',
    icon: Zap,
    href: '/automations',
    color: 'border-border opacity-60',
    iconBg: 'bg-slate-500/10 text-slate-400',
    active: false,
    badge: 'Coming Soon',
  },
  {
    id: 'reporting',
    name: 'Reporting as a Service',
    abbr: 'RaaS',
    description:
      'Executive and technical security reports. Weekly detection briefs, monthly ATT&CK delta reports, and MTTD benchmarks.',
    icon: FileText,
    href: '/reports',
    color: 'border-border opacity-60',
    iconBg: 'bg-slate-500/10 text-slate-400',
    active: false,
    badge: 'Coming Soon',
  },
];

export default function ModulesPage() {
  const user = useCurrentUser();

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Modules" />

      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}.
          </h2>
          <p className="text-sm text-muted-foreground">Select a module to get started.</p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const card = (
              <div
                className={cn(
                  'group relative rounded-2xl border bg-card p-6 shadow-sm transition-all duration-200',
                  mod.active
                    ? cn('cursor-pointer hover:shadow-lg', mod.color)
                    : 'cursor-not-allowed border-border opacity-50',
                )}
              >
                {/* Badge */}
                {mod.badge && (
                  <span
                    className={cn(
                      'absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black tracking-widest uppercase',
                      mod.active
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-muted text-muted-foreground border border-border',
                    )}
                  >
                    {!mod.active && <Lock className="h-2.5 w-2.5" />}
                    {mod.badge}
                  </span>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'mb-4 flex h-11 w-11 items-center justify-center rounded-xl',
                    mod.iconBg,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="space-y-1 mb-4">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-semibold text-foreground">{mod.name}</h3>
                    <span className="text-xs font-bold text-muted-foreground">{mod.abbr}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                </div>

                {/* CTA */}
                {mod.active && (
                  <div className="flex items-center gap-1 text-sm font-medium text-amber-400 group-hover:text-amber-300 transition-colors">
                    Open {mod.abbr}{' '}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                )}
              </div>
            );

            return mod.active ? (
              <Link key={mod.id} href={mod.href} className="block">
                {card}
              </Link>
            ) : (
              <div key={mod.id}>{card}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
