'use client';

import { Header } from '@/components/layout/header';
import { Bell, CheckCheck, Circle, MessageSquare, UserPlus, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const NOTIFICATIONS = [
  {
    id: '1',
    type: 'mention',
    icon: MessageSquare,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20',
    title: 'Bob mentioned you in "Sprint Planning"',
    body: '@Alice can you review the auth API spec before Thursday?',
    time: '12m ago',
    read: false,
  },
  {
    id: '2',
    type: 'invite',
    icon: UserPlus,
    iconClass:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20',
    title: 'Eve Smith accepted your invite',
    body: 'Eve joined Demo Corp as a Member.',
    time: '1h ago',
    read: false,
  },
  {
    id: '3',
    type: 'automation',
    icon: Zap,
    iconClass:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20',
    title: 'Automation triggered: "Move to Done"',
    body: '"Setup CI pipeline" was automatically moved to Done in Sprint Planning.',
    time: '3h ago',
    read: false,
  },
  {
    id: '4',
    type: 'mention',
    icon: MessageSquare,
    iconClass:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20',
    title: 'Carol commented on "Bug Tracker"',
    body: 'Reproduced on v1.0.2 — refresh token race condition confirmed.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: '5',
    type: 'automation',
    icon: Zap,
    iconClass:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20',
    title: 'Automation triggered: "Assign due date"',
    body: '"Marketing Q3" items without due dates were flagged.',
    time: '2d ago',
    read: true,
  },
];

export default function NotificationsPage() {
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Notifications" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {unread} unread
              </span>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
            {NOTIFICATIONS.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-4 px-5 py-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer',
                    !n.read && 'bg-amber-50/60 dark:bg-amber-500/5',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      n.iconClass,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm',
                          !n.read
                            ? 'font-semibold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-zinc-300',
                        )}
                      >
                        {n.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                          {n.time}
                        </span>
                        {!n.read && <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />}
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">
                      {n.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Load older notifications <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </main>
    </div>
  );
}
