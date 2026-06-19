'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Users, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    const isClarbit = user?.email?.toLowerCase().endsWith('@clarbit.com') ?? false;
    if (user?.role !== 'SUPER_ADMIN' || !isClarbit) {
      router.push('/modules');
    }
  }, [user, isAuthenticated, router]);

  const isClarbit = user?.email?.toLowerCase().endsWith('@clarbit.com') ?? false;
  if (!isAuthenticated || user?.role !== 'SUPER_ADMIN' || !isClarbit) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-sm">OneMDR</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black tracking-widest uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Admin
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link
              href="/admin/tenant-requests"
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                pathname.startsWith('/admin/tenant-requests')
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Customer Onboarding
            </Link>
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block">{user?.email}</span>
            <button
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
