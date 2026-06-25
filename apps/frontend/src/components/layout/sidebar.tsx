'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  LayoutDashboard,
  ShieldCheck,
  Target,
  Database,
  Search,
  FileText,
  Users,
  Settings,
  Building2,
  ChevronRight,
  Brain,
  Crosshair,
  Microscope,
  BookOpen,
  Fingerprint,
  ChevronDown,
  Phone,
  AlertCircle,
  FolderOpen,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { useState } from 'react';

const DAAS_NAV = [
  { label: 'SOC Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Detection Library', href: '/detections', icon: ShieldCheck },
  { label: 'ATT&CK Navigator', href: '/coverage', icon: Target },
  { label: 'AI Systems', href: '/ai-systems', icon: Brain },
  { label: 'Integrations', href: '/integrations', icon: Database },
  { label: 'Executive Bulletins', href: '/reports', icon: FileText },
];

const THAAS_NAV = [
  { label: 'Hunt Dashboard', href: '/thaas', icon: Crosshair },
  { label: 'Hunt Missions', href: '/thaas/missions', icon: Search },
  { label: 'Hypotheses', href: '/thaas/hypotheses', icon: Microscope },
  { label: 'IOC Tracker', href: '/thaas/iocs', icon: Fingerprint },
  { label: 'Playbooks', href: '/thaas/playbooks', icon: BookOpen },
];

const OPS_NAV = [
  { label: 'SOC Roster', href: '/members', icon: Users },
  { label: 'On-Call', href: '/soc/oncall', icon: Phone },
  { label: 'Incidents', href: '/soc/incidents', icon: AlertCircle },
  { label: 'Documentation', href: '/soc/docs', icon: FolderOpen },
  { label: 'Activity', href: '/notifications', icon: Activity },
];

const DAAS_PATHS = DAAS_NAV.map((n) => n.href);
const THAAS_PATHS = THAAS_NAV.map((n) => n.href);

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const inDaaS = DAAS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const inTHaaS = THAAS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const inModules = pathname === '/modules';

  const [daasExpanded, setDaasExpanded] = useState(true);
  const [thaasExpanded, setThaasExpanded] = useState(true);
  const [opsExpanded, setOpsExpanded] = useState(true);

  return (
    <aside className="flex h-full w-64 flex-col bg-white/80 dark:bg-black/40 border-r border-black/10 dark:border-white/10 backdrop-blur-xl shrink-0">
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <Link
        href="/modules"
        className="flex items-center gap-2.5 border-b border-black/10 dark:border-white/10 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-500/30">
          M
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            OneMDR
          </h2>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
            Platform
          </p>
        </div>
      </Link>

      {/* ── Module breadcrumb ────────────────────────────────────────── */}
      {(inDaaS || inTHaaS) && (
        <div className="flex items-center gap-1.5 border-b border-black/10 dark:border-white/10 px-4 py-2.5">
          <Link
            href="/modules"
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Modules
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              inTHaaS ? 'text-purple-400' : 'text-amber-400',
            )}
          >
            {inTHaaS ? 'THaaS' : 'DaaS'}
          </span>
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Module hub link */}
        <div>
          <span className="block px-2.5 pb-1.5 text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            Home
          </span>
          <Link
            href="/modules"
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all border',
              inModules
                ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold dark:bg-blue-600/10 dark:border-blue-600/20 dark:text-blue-300'
                : 'border-transparent text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
            )}
          >
            <LayoutGrid
              className={cn(
                'h-4 w-4 shrink-0',
                inModules ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-500',
              )}
            />
            Module Hub
          </Link>
        </div>

        {/* DaaS nav — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setDaasExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-2.5 pb-1.5 group"
          >
            <span className="text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
              Detection as a Service
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-slate-400 dark:text-zinc-500 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-zinc-300',
                daasExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </button>
          {daasExpanded && (
            <ul className="space-y-0.5">
              {DAAS_NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all border',
                        active
                          ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold dark:bg-blue-600/10 dark:border-blue-600/20 dark:text-blue-300'
                          : 'border-transparent text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active
                            ? 'text-blue-700 dark:text-white'
                            : 'text-slate-400 dark:text-zinc-500',
                        )}
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* THaaS nav — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setThaasExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-2.5 pb-1.5 group"
          >
            <span className="text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
              Threat Hunting as a Service
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-slate-400 dark:text-zinc-500 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-zinc-300',
                thaasExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </button>
          {thaasExpanded && (
            <ul className="space-y-0.5">
              {THAAS_NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all border',
                        active
                          ? 'bg-purple-50 border-purple-200 text-purple-900 font-semibold dark:bg-purple-600/10 dark:border-purple-600/20 dark:text-purple-300'
                          : 'border-transparent text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active
                            ? 'text-purple-700 dark:text-purple-300'
                            : 'text-slate-400 dark:text-zinc-500',
                        )}
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Operations nav — collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setOpsExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-2.5 pb-1.5 group"
          >
            <span className="text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
              SOC Operations
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 text-slate-400 dark:text-zinc-500 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-zinc-300',
                opsExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </button>
          {opsExpanded && (
            <ul className="space-y-0.5">
              {OPS_NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all border',
                        active
                          ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-600/10 dark:border-blue-600/20 dark:text-blue-300'
                          : 'border-transparent text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active
                            ? 'text-blue-700 dark:text-white'
                            : 'text-slate-400 dark:text-zinc-500',
                        )}
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      {/* ── Bottom: settings + profile ──────────────────────────────── */}
      <div className="border-t border-black/10 dark:border-white/10 px-3 py-3 space-y-0.5">
        {(user?.role === 'OWNER' || user?.role === 'ADMIN') && user?.tenantType === 'MSSP' && (
          <Link
            href="/tenants"
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all border',
              pathname === '/tenants'
                ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-600/10 dark:border-blue-600/20 dark:text-blue-300'
                : 'border-transparent text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
            )}
          >
            <Building2 className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
            Organisation
          </Link>
        )}
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-black/5 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-all border border-transparent"
        >
          <Settings className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
          Settings
        </Link>
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {user ? getInitials(user.firstName, user.lastName) : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700 dark:text-zinc-200">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <p className="truncate text-[10px] text-slate-400 dark:text-zinc-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
