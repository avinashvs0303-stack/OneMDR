'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid2X2, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';

const TABS = [
  { label: 'Browse Apps', href: '/integrations/browse', icon: Grid2X2 },
  { label: 'Active Integrations', href: '/integrations/active', icon: Plug },
];

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Integrations" />

      {/* Sub-nav */}
      <div className="flex items-center gap-1 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 px-6 shrink-0">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors',
                active
                  ? 'border-teal-500 text-teal-700 dark:text-teal-300'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200',
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  active ? 'text-teal-500' : 'text-slate-400 dark:text-zinc-500',
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
