'use client';

import { Header } from '@/components/layout/header';
import { Zap, Plus, ToggleLeft, ToggleRight, Play, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTOMATIONS = [
  { id: '1', name: 'Move to Done when all sub-items complete', board: 'Sprint Planning', trigger: 'Sub-item completed', action: 'Move item to Done', runs: 47, enabled: true, lastRun: '12m ago' },
  { id: '2', name: 'Assign due date to new items', board: 'Bug Tracker', trigger: 'Item created', action: 'Set due date +3 days', runs: 22, enabled: true, lastRun: '1h ago' },
  { id: '3', name: 'Notify owner when item moves to Review', board: 'Product Roadmap', trigger: 'Status → Review', action: 'Notify assignee', runs: 18, enabled: true, lastRun: '3h ago' },
  { id: '4', name: 'Archive items older than 90 days', board: 'All boards', trigger: 'Scheduled (daily)', action: 'Move to archive', runs: 5, enabled: false, lastRun: '2d ago' },
  { id: '5', name: 'Flag overdue items in red', board: 'Marketing Q3', trigger: 'Due date passed', action: 'Set priority → Critical', runs: 12, enabled: true, lastRun: 'Yesterday' },
];

export default function AutomationsPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Automations" />
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total automations', value: '5' },
            { label: 'Active', value: '4' },
            { label: 'Runs this week', value: '237' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm dark:shadow-lg">
              <p className="text-xs text-slate-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-400">Your automations</h2>
          <button type="button" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
            <Plus className="h-3.5 w-3.5" /> New automation
          </button>
        </div>

        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-lg divide-y divide-black/5 dark:divide-white/5 overflow-hidden">
          {AUTOMATIONS.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                a.enabled
                  ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-400'
                  : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-400 dark:text-zinc-500',
              )}>
                <Zap className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{a.name}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {a.trigger}</span>
                  <span>→ {a.action}</span>
                  <span className="hidden sm:flex items-center gap-1"><Clock className="h-3 w-3" /> {a.lastRun}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{a.board}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:block text-xs text-slate-500 dark:text-zinc-400">{a.runs} runs</span>
                {a.enabled
                  ? <ToggleRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  : <ToggleLeft className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
                }
                <ChevronRight className="h-4 w-4 text-slate-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">Automate repetitive work</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Create rules that trigger actions automatically — no code required.</p>
          <button type="button" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
            <Plus className="h-3.5 w-3.5" /> Build automation
          </button>
        </div>
      </main>
    </div>
  );
}
