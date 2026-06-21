'use client';

import { Header } from '@/components/layout/header';
import { Microscope } from 'lucide-react';

export default function HypothesesPage() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Hunt Hypotheses" />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10">
            <Microscope className="h-7 w-7 text-purple-500" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Hypotheses</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs">
            Intelligence-driven hypotheses module — coming in the next sprint.
          </p>
        </div>
      </main>
    </div>
  );
}
