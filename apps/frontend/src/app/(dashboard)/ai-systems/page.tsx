'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Brain, Download, Info, X, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATLAS_MATRIX } from '@/data/atlas-matrix';
import { getCoverageColor, type AttackTechnique, type AttackTactic } from '@/data/attack-matrix';

interface TooltipState {
  technique: AttackTechnique;
  tactic: AttackTactic;
  x: number;
  y: number;
}

function computeStats(matrix: AttackTactic[]) {
  const total = matrix.reduce((s, t) => s + t.techniques.length, 0);
  return { total, covered: 0, strong: 0, pct: 0 };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AISystemsPage() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    tech: AttackTechnique;
    tactic: AttackTactic;
  } | null>(null);

  const stats = useMemo(() => computeStats(ATLAS_MATRIX), []);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="AI Systems Heatmap" />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Controls bar */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md px-6 py-3 gap-4 shrink-0">
          <div className="flex items-center gap-6">
            <Stat
              label="Techniques"
              value={`${stats.total}`}
              color="text-slate-900 dark:text-white"
            />
            <Stat
              label="Covered"
              value={`${stats.covered}`}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label="Gaps"
              value={`${stats.total - stats.covered}`}
              color="text-red-500 dark:text-red-400"
            />
            <Stat
              label="Coverage"
              value={`${stats.pct}%`}
              color="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Legend */}
            <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500 border-r border-black/10 dark:border-white/10 pr-3">
              <LegendItem className="bg-white/5 border border-white/10" label="No coverage" />
              <LegendItem className="bg-yellow-500/20" label="1-2 rules" />
              <LegendItem className="bg-emerald-500/20" label="3-4 rules" />
              <LegendItem className="bg-emerald-500/40" label="5-6 rules" />
              <LegendItem className="bg-emerald-500/70" label="7+ rules" />
            </div>

            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export Layer
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="shrink-0 flex items-center gap-2 px-6 py-2 bg-purple-500/10 border-b border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300">
          <Brain className="h-3.5 w-3.5 shrink-0" />
          <span>
            AI Systems threat matrix covering adversarial tactics and techniques targeting
            machine-learning models, LLMs, and AI pipelines. Assign AI System technique IDs to
            detection rules to populate coverage.
          </span>
        </div>

        {/* Heatmap + Detail panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <div className="inline-flex gap-1 min-w-max">
              {ATLAS_MATRIX.map((tactic) => (
                <div key={tactic.id} className="flex flex-col gap-0.5" style={{ width: 110 }}>
                  {/* Tactic header */}
                  <div className={cn('rounded-t px-2 py-1.5 text-center text-white', tactic.color)}>
                    <p className="text-[10px] font-black uppercase tracking-wide leading-tight">
                      {tactic.shortName}
                    </p>
                    <p className="text-[9px] opacity-70 mt-0.5">{tactic.id}</p>
                  </div>

                  {/* Technique cells */}
                  {tactic.techniques.map((tech) => (
                    <button
                      key={`${tactic.id}-${tech.id}`}
                      type="button"
                      onClick={() =>
                        setSelectedCell(
                          selectedCell?.tech.id === tech.id && selectedCell.tactic.id === tactic.id
                            ? null
                            : { tech, tactic },
                        )
                      }
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ technique: tech, tactic, x: rect.left, y: rect.bottom + 8 });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className={cn(
                        'w-full rounded px-1.5 py-1.5 text-left transition-all border',
                        getCoverageColor(tech.coverage),
                        selectedCell?.tech.id === tech.id && selectedCell.tactic.id === tactic.id
                          ? 'ring-2 ring-purple-500 ring-offset-1 dark:ring-purple-400'
                          : 'hover:ring-1 hover:ring-black/30 dark:hover:ring-white/30',
                      )}
                    >
                      <p className="text-[9px] font-bold leading-tight">{tech.id}</p>
                      <p className="text-[9px] leading-tight mt-0.5 line-clamp-2 opacity-90">
                        {tech.name}
                      </p>
                      {tech.coverage > 0 && (
                        <p className="text-[9px] font-bold mt-0.5 opacity-70">{tech.coverage}✓</p>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selectedCell && (
            <div className="w-80 shrink-0 border-l border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-md overflow-y-auto">
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      {selectedCell.tech.id}
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                      {selectedCell.tech.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {selectedCell.tactic.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedCell.tech.coverage}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Detections</p>
                  </div>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
                    <p className="text-sm font-bold text-red-500 dark:text-red-400">Gap</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Status</p>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-purple-500/30 bg-purple-50 dark:bg-purple-500/5 p-4 text-center space-y-2">
                  <Target className="mx-auto h-6 w-6 text-purple-500 dark:text-purple-400" />
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    No detections mapped
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Assign technique ID{' '}
                    <span className="font-mono font-bold">{selectedCell.tech.id}</span> to a
                    detection rule to track coverage here.
                  </p>
                </div>

                <div className="border-t border-black/10 dark:border-white/10 pt-3 flex flex-col gap-2">
                  <a
                    href={`https://atlas.mitre.org/techniques/${selectedCell.tech.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    <Info className="h-3 w-3" />
                    Reference documentation
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-3 max-w-[200px]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-[10px] text-slate-400 dark:text-zinc-500">{tooltip.technique.id}</p>
          <p className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">
            {tooltip.technique.name}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
            {tooltip.tactic.name}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/5 border border-white/10" />
            <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300">
              No coverage
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{label}</p>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-3 w-3 rounded-sm', className)} />
      {label}
    </span>
  );
}
