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
  Bell,
  Users,
  Settings,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';

const DAAS_NAV = [
  { label: 'SOC Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Detection Library', href: '/detections', icon: ShieldCheck },
  { label: 'ATT&CK Navigator', href: '/coverage', icon: Target },
  { label: 'SIEM Monitors', href: '/siem', icon: Database },
  { label: 'Threat Hunt Missions', href: '/hunts', icon: Search },
  { label: 'Executive Bulletins', href: '/reports', icon: FileText },
];

const OPS_NAV = [
  { label: 'My Team', href: '/members', icon: Users },
  { label: 'Notifications', href: '/notifications', icon: Bell },
];

const DAAS_PATHS = DAAS_NAV.map((n) => n.href);

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const inDaaS = DAAS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const inModules = pathname === '/modules';

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

      {/* ── Module breadcrumb (when inside DaaS) ────────────────────── */}
      {inDaaS && (
        <div className="flex items-center gap-1.5 border-b border-black/10 dark:border-white/10 px-4 py-2.5">
          <Link
            href="/modules"
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Modules
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
            DaaS
          </span>
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Module hub link — always visible */}
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

        {/* DaaS nav — shown when inside DaaS or always */}
        <div>
          <span className="block px-2.5 pb-1.5 text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            Detection as a Service
          </span>
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
        </div>

        <div>
          <span className="block px-2.5 pb-1.5 text-[9px] text-slate-400 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            Operations
          </span>
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
