'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type PrefRow = { id: string; label: string; desc: string; email: boolean; inApp: boolean };

const DEFAULT_PREFS: PrefRow[] = [
  {
    id: 'detection_deployed',
    label: 'Detection deployed',
    desc: 'When a detection is successfully pushed to a SIEM integration',
    email: true,
    inApp: true,
  },
  {
    id: 'detection_failed',
    label: 'Detection deployment failed',
    desc: 'When a detection deployment returns an error',
    email: true,
    inApp: true,
  },
  {
    id: 'hunt_created',
    label: 'Hunt mission created',
    desc: 'When a new threat hunt mission is opened in your workspace',
    email: false,
    inApp: true,
  },
  {
    id: 'hunt_completed',
    label: 'Hunt mission completed',
    desc: 'When a threat hunt mission status changes to Complete',
    email: true,
    inApp: true,
  },
  {
    id: 'member_invited',
    label: 'New team member',
    desc: 'When someone is invited to or joins your workspace',
    email: true,
    inApp: true,
  },
  {
    id: 'integration_status',
    label: 'Integration status change',
    desc: 'When a SIEM integration goes offline or reconnects',
    email: true,
    inApp: true,
  },
  {
    id: 'schedule_run',
    label: 'Scheduled hunt run',
    desc: 'When an automated threat hunt schedule completes or finds results',
    email: false,
    inApp: true,
  },
];

export default function NotificationPrefsPage() {
  const [prefs, setPrefs] = useState<PrefRow[]>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string, channel: 'email' | 'inApp') => {
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, [channel]: !p[channel] } : p)));
  };

  const handleSave = () => {
    // Persisted locally for now; backend notification preferences endpoint coming soon
    localStorage.setItem('notification_prefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Notification Preferences" />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
          </Link>

          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0" /> Notification preferences saved.
            </div>
          )}

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg overflow-hidden">
            {/* Header row */}
            <div className="flex items-center border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-5 py-3">
              <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
                Event
              </span>
              <div className="flex items-center gap-6 shrink-0 pr-1">
                <span className="w-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
                  Email
                </span>
                <span className="w-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">
                  In-app
                </span>
              </div>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5">
              {prefs.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{p.label}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{p.desc}</p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 pr-1">
                    <div className="w-12 flex justify-center">
                      <Toggle checked={p.email} onChange={() => toggle(p.id, 'email')} />
                    </div>
                    <div className="w-12 flex justify-center">
                      <Toggle checked={p.inApp} onChange={() => toggle(p.id, 'inApp')} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
            >
              Save preferences
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-950',
        checked ? 'bg-amber-600' : 'bg-slate-200 dark:bg-white/10',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}
