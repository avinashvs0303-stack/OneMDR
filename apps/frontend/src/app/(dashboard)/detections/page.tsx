'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Search, Plus, ChevronDown, ChevronRight, Copy, ExternalLink, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DETECTIONS, SEVERITY_COLORS, STATUS_COLORS, SIEM_COLORS, type Detection } from '@/data/detections';
import { ATTACK_MATRIX } from '@/data/attack-matrix';

const ALL_TACTICS = ['All', ...Array.from(new Set(ATTACK_MATRIX.map((t) => t.name)))];
const ALL_SIEMS = ['All', 'Splunk', 'Microsoft Sentinel', 'Chronicle', 'Elastic', 'QRadar'];
const ALL_SEVERITIES = ['All', 'Critical', 'High', 'Medium', 'Low'];
const ALL_STATUSES = ['All', 'Active', 'Testing', 'Draft', 'Retired'];

export default function DetectionsPage() {
  const [search, setSearch] = useState('');
  const [tactic, setTactic] = useState('All');
  const [siem, setSiem] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<Detection | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = DETECTIONS.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.techniqueId.toLowerCase().includes(search.toLowerCase()) &&
        !d.tags.some((t) => t.includes(search.toLowerCase()))) return false;
    if (tactic !== 'All' && d.tactic !== tactic) return false;
    if (siem !== 'All' && d.siem !== siem) return false;
    if (severity !== 'All' && d.severity !== severity) return false;
    if (status !== 'All' && d.status !== status) return false;
    return true;
  });

  const copyQuery = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Detection Library" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: list ────────────────────────────────────────────── */}
        <div className={cn('flex flex-col min-h-0 overflow-hidden border-r border-black/10 dark:border-white/10', selected ? 'w-[55%]' : 'flex-1')}>

          {/* Toolbar */}
          <div className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search detections, technique IDs, tags…"
                  className="flex-1 bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
                />
              </div>
              <button type="button" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
                <Plus className="h-3.5 w-3.5" /> New Detection
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterSelect label="Tactic" value={tactic} options={ALL_TACTICS} onChange={setTactic} />
              <FilterSelect label="SIEM" value={siem} options={ALL_SIEMS} onChange={setSiem} />
              <FilterSelect label="Severity" value={severity} options={ALL_SEVERITIES} onChange={setSeverity} />
              <FilterSelect label="Status" value={status} options={ALL_STATUSES} onChange={setStatus} />
              <span className="ml-auto text-xs text-slate-400 dark:text-zinc-500">{filtered.length} results</span>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white/90 dark:bg-black/40 backdrop-blur-md border-b border-black/10 dark:border-white/10">
                <tr>
                  {['', 'Detection', 'Technique', 'SIEM', 'Severity', 'FP%', 'Alerts/d'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filtered.map((det) => (
                  <tr
                    key={det.id}
                    onClick={() => setSelected(det.id === selected?.id ? null : det)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selected?.id === det.id
                        ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-blue-500'
                        : 'hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <td className="px-3 py-3">
                      <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 transition-transform', selected?.id === det.id && 'rotate-90 text-blue-500 dark:text-blue-400')} />
                    </td>
                    <td className="px-3 py-3 max-w-[200px]">
                      <p className="font-medium text-slate-900 dark:text-white text-xs truncate">{det.title}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{det.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-blue-600 dark:text-blue-400">{det.techniqueId}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[120px]">{det.tactic}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold', SIEM_COLORS[det.siem])}>
                        {det.siem === 'Microsoft Sentinel' ? 'Sentinel' : det.siem}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold', SEVERITY_COLORS[det.severity])}>
                        {det.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium">
                      <span className={cn(det.metrics.fpRate > 15 ? 'text-red-500 dark:text-red-400' : det.metrics.fpRate > 8 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {det.status === 'Draft' ? '—' : `${det.metrics.fpRate}%`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700 dark:text-zinc-300">
                      {det.status === 'Draft' ? '—' : det.metrics.alertsPerDay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right: detail panel ───────────────────────────────────── */}
        {selected && (
          <div className="w-[45%] flex flex-col overflow-hidden bg-black/5 dark:bg-black/20 backdrop-blur-md">
            <div className="border-b border-black/10 dark:border-white/10 px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{selected.id}</p>
                  <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white leading-snug">{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white shrink-0 text-lg leading-none">×</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-bold', SEVERITY_COLORS[selected.severity])}>{selected.severity}</span>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', STATUS_COLORS[selected.status])}>{selected.status}</span>
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', SIEM_COLORS[selected.siem])}>{selected.siem}</span>
                <span className="rounded bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  {selected.techniqueId}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{selected.description}</p>

              {selected.status !== 'Draft' && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Alerts/Day', value: selected.metrics.alertsPerDay, color: 'text-slate-900 dark:text-white' },
                    { label: 'FP Rate', value: `${selected.metrics.fpRate}%`, color: selected.metrics.fpRate > 15 ? 'text-red-500 dark:text-red-400' : selected.metrics.fpRate > 8 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'MTTD', value: `${selected.metrics.mttd}h`, color: 'text-blue-600 dark:text-blue-400' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 text-center">
                      <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">MITRE ATT&amp;CK</p>
                <p className="text-xs font-medium text-slate-900 dark:text-white">{selected.tactic} · <span className="text-blue-600 dark:text-blue-400">{selected.techniqueId}</span></p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{selected.technique}</p>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">NIST 800-53 Controls</p>
                <div className="flex flex-wrap gap-1">
                  {selected.nistControls.map((c) => (
                    <span key={c} className="rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-2 py-0.5 text-[11px] text-slate-600 dark:text-zinc-300">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">Data Sources Required</p>
                <ul className="space-y-1">
                  {selected.dataSources.map((ds) => (
                    <li key={ds} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-600" /> {ds}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">{selected.queryLanguage} Query</p>
                  <button type="button" onClick={() => { void copyQuery(); }} className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 border border-black/10 dark:border-white/10 p-4 text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap">
                  {selected.query}
                </pre>
              </div>

              <div className="flex gap-4 text-[10px] text-slate-400 dark:text-zinc-500 border-t border-black/10 dark:border-white/10 pt-3">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {selected.created}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {selected.lastUpdated}</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {selected.status !== 'Retired' && (
              <div className="border-t border-black/10 dark:border-white/10 px-5 py-3">
                <button type="button" className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-500/20">
                  <ExternalLink className="h-4 w-4" />
                  Deploy to {selected.siem}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md pl-3 pr-7 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:border-blue-500/50 focus:outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === 'All' ? `${label}: All` : o}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-zinc-500" />
    </div>
  );
}
