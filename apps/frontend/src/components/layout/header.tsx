'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Search, Bell, ChevronDown, LogOut, User, Zap, Sun, Moon } from 'lucide-react';
import { useAuthStore, useCurrentUser } from '@/store/auth.store';
import { getInitials, cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    setMenuOpen(false); // close dropdown immediately so no flash of empty/U avatar
    await logout();
    router.push('/auth/login');
  };

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-md px-6">
      {/* Left: page title */}
      {title && <h1 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h1>}

      {/* Centre: search */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-black/5 dark:bg-white/5 px-3 py-1.5 transition-all backdrop-blur-md',
          searchFocused
            ? 'border-blue-600/60 ring-1 ring-blue-600/20'
            : 'border-black/10 dark:border-white/10',
          !title && 'mx-auto w-full max-w-sm',
          title && 'flex-1 mx-6 max-w-md',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
        <input
          type="search"
          placeholder="Search detections, techniques, SIEM rules…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
        />
        <kbd className="hidden rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-zinc-500 sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      {/* Right: actions + avatar */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {user ? getInitials(user.firstName, user.lastName) : 'U'}
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-[61] mt-1.5 w-56 rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-xl shadow-2xl">
                <div className="border-b border-black/10 dark:border-white/10 px-4 py-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <MenuLink
                    icon={User}
                    label="Profile"
                    href="/settings/profile"
                    onClick={() => setMenuOpen(false)}
                  />
                  <MenuLink
                    icon={Zap}
                    label="Upgrade plan"
                    href="/billing"
                    onClick={() => setMenuOpen(false)}
                  />
                </div>
                <div className="border-t border-black/10 dark:border-white/10 p-1.5">
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
    >
      <Icon className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
      {label}
    </a>
  );
}
