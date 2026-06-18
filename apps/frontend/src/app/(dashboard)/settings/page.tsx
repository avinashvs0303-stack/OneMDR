'use client';

import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { User, Shield, Bell, Palette, Key, Building2, ChevronRight } from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    group: 'Personal',
    items: [
      {
        href: '/settings/profile',
        icon: User,
        label: 'Profile',
        description: 'Your name, avatar, and timezone',
      },
      {
        href: '/settings/security',
        icon: Shield,
        label: 'Security',
        description: 'Password, MFA, and active sessions',
      },
      {
        href: '/settings/notifications',
        icon: Bell,
        label: 'Notification preferences',
        description: 'Email and in-app alert settings',
      },
      {
        href: '/settings/appearance',
        icon: Palette,
        label: 'Appearance',
        description: 'Theme, language, and display options',
      },
    ],
  },
  {
    group: 'Workspace',
    items: [
      {
        href: '/settings/workspace',
        icon: Building2,
        label: 'Workspace settings',
        description: 'Name, logo, and general configuration',
      },
      {
        href: '/settings/api',
        icon: Key,
        label: 'API & integrations',
        description: 'API keys, webhooks, and connected apps',
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Settings" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.group} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
                {section.group}
              </h2>
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 group-hover:bg-amber-50 group-hover:text-amber-600 group-hover:border-amber-200 dark:group-hover:bg-amber-500/10 dark:group-hover:text-amber-400 dark:group-hover:border-amber-500/25 transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
