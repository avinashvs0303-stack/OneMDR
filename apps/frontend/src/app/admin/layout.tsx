'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  Key,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const NAV = [
  {
    label: 'Overview',
    href: '/admin/overview',
    icon: LayoutDashboard,
    match: (p: string) => p === '/admin/overview' || p === '/admin',
  },
  {
    label: 'Leads',
    href: '/admin/leads',
    icon: Users,
    match: (p: string) =>
      p.startsWith('/admin/leads') ||
      p.startsWith('/admin/requests') ||
      p.startsWith('/admin/tenant-requests'),
  },
  {
    label: 'Tenants',
    href: '/admin/tenants',
    icon: Building2,
    match: (p: string) => p.startsWith('/admin/tenants'),
  },
  {
    label: 'Licenses',
    href: '/admin/licenses',
    icon: Key,
    match: (p: string) => p.startsWith('/admin/licenses'),
  },
  {
    label: 'Support',
    href: '/admin/support-cases',
    icon: LifeBuoy,
    match: (p: string) => p.startsWith('/admin/support-cases'),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Login page renders its own full-screen layout — skip the admin shell
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isClarbit = user?.email?.toLowerCase().endsWith('@clarbit.com') ?? false;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/admin/login');
      return;
    }
    if (user?.role !== 'SUPER_ADMIN' || !isClarbit) {
      router.replace('/admin/login');
    }
  }, [user, isAuthenticated, isClarbit, router]);

  if (!isAuthenticated || user?.role !== 'SUPER_ADMIN' || !isClarbit) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-white/10 bg-slate-950 transition-transform duration-200 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Clarbit</p>
            <p className="text-[10px] font-black tracking-widest uppercase text-amber-500">
              Admin Console
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded p-1 hover:bg-white/5 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 py-4">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300',
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3 text-amber-500" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
              {(user?.firstName?.[0] ?? 'C').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={() => void handleLogout()}
              title="Sign out"
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-slate-950 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 hover:bg-white/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ShieldCheck className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Clarbit Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
