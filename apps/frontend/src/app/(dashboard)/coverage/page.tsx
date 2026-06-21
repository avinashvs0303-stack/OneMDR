'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Target, Download, Filter, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ATTACK_MATRIX,
  getCoverageColor,
  type AttackTechnique,
  type AttackTactic,
} from '@/data/attack-matrix';
import {
  detectionsApi,
  type DetectionRow,
  type DetectionPlatform,
  PLATFORM_COLORS,
  PLATFORM_LABEL,
  SEVERITY_COLORS,
  type DetectionSeverity,
} from '@/lib/detections.api';

type PlatformFilter = 'ALL' | DetectionPlatform;

const PLATFORM_OPTIONS: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'ALL', label: 'All Platforms' },
  { value: 'SPLUNK', label: 'Splunk' },
  { value: 'SENTINEL', label: 'Sentinel' },
  { value: 'CHRONICLE', label: 'Chronicle' },
  { value: 'ELASTIC', label: 'Elastic' },
  { value: 'QRADAR', label: 'QRadar' },
  { value: 'SIGMA', label: 'SIGMA' },
];

interface TooltipState {
  technique: AttackTechnique;
  tactic: AttackTactic;
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCoverageMap(detections: DetectionRow[]): Map<string, DetectionRow[]> {
  const map = new Map<string, DetectionRow[]>();
  for (const d of detections) {
    if (!d.mitreAttackId) continue;
    const existing = map.get(d.mitreAttackId) ?? [];
    map.set(d.mitreAttackId, [...existing, d]);
  }
  return map;
}

function techCoverageCount(techId: string, map: Map<string, DetectionRow[]>): number {
  let count = 0;
  for (const [id, dets] of map.entries()) {
    if (id.startsWith(techId)) count += dets.length;
  }
  return count;
}

function techDetections(techId: string, map: Map<string, DetectionRow[]>): DetectionRow[] {
  const result: DetectionRow[] = [];
  for (const [id, dets] of map.entries()) {
    if (id.startsWith(techId)) result.push(...dets);
  }
  return result;
}

function computeStats(map: Map<string, DetectionRow[]>) {
  let total = 0;
  let covered = 0;
  let strong = 0;
  for (const tactic of ATTACK_MATRIX) {
    for (const tech of tactic.techniques) {
      total++;
      const count = techCoverageCount(tech.id, map);
      if (count > 0) covered++;
      if (count >= 5) strong++;
    }
  }
  return { total, covered, strong, pct: total > 0 ? Math.round((covered / total) * 100) : 0 };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoveragePage() {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    tech: AttackTechnique;
    tactic: AttackTactic;
  } | null>(null);
  const [allEnabled, setAllEnabled] = useState<DetectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnabled = useCallback(async () => {
    try {
      const data = await detectionsApi.list({ enabled: 'true' });
      setAllEnabled(data);
    } catch (err) {
      console.error('Coverage fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEnabled();
  }, [fetchEnabled]);

  const filtered = useMemo(
    () =>
      platformFilter === 'ALL'
        ? allEnabled
        : allEnabled.filter((d) => d.platform === platformFilter),
    [allEnabled, platformFilter],
  );

  const coverageMap = useMemo(() => buildCoverageMap(filtered), [filtered]);

  const stats = useMemo(() => computeStats(coverageMap), [coverageMap]);

  const matrix = useMemo(
    () =>
      ATTACK_MATRIX.map((tactic) => ({
        ...tactic,
        techniques: tactic.techniques.map((tech) => ({
          ...tech,
          coverage: techCoverageCount(tech.id, coverageMap),
        })),
      })),
    [coverageMap],
  );

  const detForCell = useMemo(
    () => (selectedCell ? techDetections(selectedCell.tech.id, coverageMap) : []),
    [selectedCell, coverageMap],
  );

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="ATT&CK Navigator Heatmap" />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Controls */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 backdrop-blur-md px-6 py-3 gap-4 shrink-0">
          <div className="flex items-center gap-6">
            <Stat
              label="Coverage"
              value={loading ? '—' : `${stats.pct}%`}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label="Covered"
              value={loading ? '—' : `${stats.covered}`}
              color="text-slate-900 dark:text-white"
            />
            <Stat
              label="Gaps"
              value={loading ? '—' : `${stats.total - stats.covered}`}
              color="text-red-500 dark:text-red-400"
            />
            <Stat
              label="Strong (5+)"
              value={loading ? '—' : `${stats.strong}`}
              color="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-2 py-1.5">
              <Filter className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
              <select
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value as PlatformFilter);
                  setSelectedCell(null);
                }}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Legend — colors match getCoverageColor exactly */}
            <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500 border-l border-black/10 dark:border-white/10 pl-3">
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

        {/* ATT&CK Matrix */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-slate-400 dark:text-zinc-500">
                  Loading coverage data...
                </p>
              </div>
            ) : (
              <div className="inline-flex gap-1 min-w-max">
                {matrix.map((tactic) => (
                  <div key={tactic.id} className="flex flex-col gap-0.5" style={{ width: 110 }}>
                    <div
                      className={cn('rounded-t px-2 py-1.5 text-center text-white', tactic.color)}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wide leading-tight">
                        {tactic.shortName}
                      </p>
                      <p className="text-[9px] opacity-70 mt-0.5">{tactic.id}</p>
                    </div>

                    {tactic.techniques.map((tech) => (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() =>
                          setSelectedCell(
                            selectedCell?.tech.id === tech.id ? null : { tech, tactic },
                          )
                        }
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            technique: tech,
                            tactic,
                            x: rect.left,
                            y: rect.bottom + 8,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={cn(
                          'w-full rounded px-1.5 py-1.5 text-left transition-all border',
                          getCoverageColor(tech.coverage),
                          selectedCell?.tech.id === tech.id
                            ? 'ring-2 ring-amber-500 ring-offset-1 dark:ring-amber-400'
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
            )}
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
                      {detForCell.length}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Detections</p>
                  </div>
                  <div
                    className={cn(
                      'rounded-lg border p-3 text-center',
                      detForCell.length > 0
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-red-500/30 bg-red-500/10',
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-bold',
                        detForCell.length > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400',
                      )}
                    >
                      {detForCell.length > 0 ? 'Covered' : 'Gap'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">Status</p>
                  </div>
                </div>

                {detForCell.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                      Detections
                    </p>
                    {detForCell.map((det) => (
                      <div
                        key={det.id}
                        className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-1.5"
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                          {det.name}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={cn(
                              'text-[10px] rounded px-1.5 py-0.5 font-medium',
                              PLATFORM_COLORS[det.platform as DetectionPlatform],
                            )}
                          >
                            {PLATFORM_LABEL[det.platform as DetectionPlatform] ?? det.platform}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] rounded px-1.5 py-0.5 font-medium',
                              SEVERITY_COLORS[det.severity as DetectionSeverity],
                            )}
                          >
                            {det.severity}
                          </span>
                        </div>
                        {(det.expectedFpRate != null || det.expectedAlertsPerDay != null) && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {det.expectedFpRate != null
                              ? `FP: ${det.expectedFpRate.toFixed(1)}%`
                              : ''}
                            {det.expectedFpRate != null && det.expectedAlertsPerDay != null
                              ? ' · '
                              : ''}
                            {det.expectedAlertsPerDay != null
                              ? `${det.expectedAlertsPerDay.toFixed(1)} alerts/day`
                              : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-red-500/30 bg-red-50 dark:bg-red-500/5 p-4 text-center space-y-2">
                    <Target className="mx-auto h-6 w-6 text-red-500 dark:text-red-400" />
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      No detections for this technique
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      Coverage gap — consider building a detection rule.
                    </p>
                    <button
                      type="button"
                      className="mt-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
                    >
                      Request Detection
                    </button>
                  </div>
                )}

                <div className="border-t border-black/10 dark:border-white/10 pt-3">
                  <a
                    href={`https://attack.mitre.org/techniques/${selectedCell.tech.id.replace('.', '/')}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    <Info className="h-3 w-3" />
                    View on MITRE ATT&CK
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
            <span
              className={cn(
                'h-2 w-2 rounded-sm',
                getCoverageColor(tooltip.technique.coverage).split(' ')[0],
              )}
            />
            <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300">
              {tooltip.technique.coverage === 0
                ? 'No coverage'
                : `${tooltip.technique.coverage} detection${tooltip.technique.coverage > 1 ? 's' : ''}`}
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
