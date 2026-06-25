'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { ChevronLeft, Monitor, Sun, Moon, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Theme = 'system' | 'light' | 'dark';

const THEMES: { value: Theme; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS preference' },
  { value: 'light', label: 'Light', icon: Sun, desc: 'Always light mode' },
  { value: 'dark', label: 'Dark', icon: Moon, desc: 'Always dark mode' },
];

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable', desc: 'More padding and whitespace' },
  { value: 'compact', label: 'Compact', desc: 'Tighter layout, more visible at once' },
];

export default function AppearancePage() {
  const [theme, setTheme] = useState<Theme>('system');
  const [density, setDensity] = useState('comfortable');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setTheme(stored);
    const storedDensity = localStorage.getItem('density');
    if (storedDensity) setDensity(storedDensity);
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else if (t === 'light') root.classList.remove('dark');
    else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  const handleSave = () => {
    localStorage.setItem('density', density);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Appearance" />
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
              <CheckCircle className="h-4 w-4 shrink-0" /> Appearance preferences saved.
            </div>
          )}

          {/* Theme */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Colour theme</h2>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all',
                    theme === value
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-sm shadow-amber-500/10'
                      : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      theme === value
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-zinc-500',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      theme === value
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-700 dark:text-zinc-300',
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-6 shadow-sm dark:shadow-lg space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Display density
            </h2>
            <div className="space-y-2">
              {DENSITY.map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-all',
                    density === value
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20',
                  )}
                >
                  <input
                    type="radio"
                    name="density"
                    value={value}
                    checked={density === value}
                    onChange={() => setDensity(value)}
                    className="accent-amber-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{desc}</p>
                  </div>
                </label>
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
