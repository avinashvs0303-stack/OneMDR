'use client';

import { Header } from '@/components/layout/header';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const METRICS = [
  { label: 'Items completed', value: '142', change: '+18%', up: true, period: 'vs last month' },
  { label: 'Avg. cycle time', value: '3.2d', change: '-0.5d', up: true, period: 'faster than last month' },
  { label: 'Overdue items', value: '7', change: '-3', up: true, period: 'vs last month' },
  { label: 'Automation saves', value: '14h', change: '+2h', up: true, period: 'estimated this week' },
];

const BOARD_HEALTH = [
  { name: 'Product Roadmap', onTrack: 22, atRisk: 8, overdue: 4, total: 34 },
  { name: 'Sprint Planning', onTrack: 12, atRisk: 4, overdue: 2, total: 18 },
  { name: 'Bug Tracker', onTrack: 14, atRisk: 5, overdue: 3, total: 22 },
  { name: 'Marketing Q3', onTrack: 7, atRisk: 2, overdue: 1, total: 10 },
];

const VELOCITY = [
  { week: 'Wk 21', completed: 28 },
  { week: 'Wk 22', completed: 34 },
  { week: 'Wk 23', completed: 22 },
  { week: 'Wk 24', completed: 41 },
  { week: 'Wk 25', completed: 38 },
  { week: 'Wk 26', completed: 47 },
];

const MAX_VELOCITY = Math.max(...VELOCITY.map((v) => v.completed));

export default function AnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Analytics" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg">
              <p className="text-xs text-slate-500 dark:text-zinc-400">{m.label}</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{m.value}</p>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {m.up ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{m.change}</span>
                <span className="text-slate-500 dark:text-zinc-400">{m.period}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Weekly velocity</h3>
              <span className="text-xs text-slate-500 dark:text-zinc-400">Items completed / week</span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {VELOCITY.map((v) => (
                <div key={v.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">{v.completed}</span>
                  <div className="w-full rounded-t-md bg-blue-500/15 hover:bg-blue-500/30 transition-colors relative overflow-hidden" style={{ height: `${(v.completed / MAX_VELOCITY) * 100}%` }}>
                    <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-blue-500" style={{ height: `${(v.completed / MAX_VELOCITY) * 60}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">{v.week}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Board health</h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> On track</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> At risk</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> Overdue</span>
              </div>
            </div>
            <div className="space-y-3">
              {BOARD_HEALTH.map((b) => (
                <div key={b.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900 dark:text-white">{b.name}</span>
                    <span className="text-slate-500 dark:text-zinc-400">{b.total} items</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="bg-emerald-500" style={{ width: `${(b.onTrack / b.total) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(b.atRisk / b.total) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(b.overdue / b.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm dark:shadow-lg space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Workload distribution</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['Alice Owner', 'Bob Admin', 'Carol Member', 'Dave Guest'].map((name, i) => {
              const items = [12, 9, 14, 4][i]!;
              const overdue = [1, 2, 0, 1][i]!;
              return (
                <div key={name} className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <span className="text-xs font-medium text-slate-900 dark:text-white truncate">{name.split(' ')[0]}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Open</span>
                      <span className="font-medium text-slate-900 dark:text-white">{items}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-500" /> Overdue</span>
                      <span className={cn('font-medium', overdue > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white')}>{overdue}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
