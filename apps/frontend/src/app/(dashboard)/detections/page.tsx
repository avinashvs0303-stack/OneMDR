'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Copy,
  Upload,
  X,
  Shield,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectionsApi,
  type DetectionRow,
  type CreateDetectionPayload,
  type DetectionSeverity,
  type DetectionPlatform,
  type QueryLanguage,
  SEVERITY_LABEL,
  SEVERITY_COLORS,
  PLATFORM_LABEL,
  PLATFORM_COLORS,
  QUERY_LANG_LABEL,
} from '@/lib/detections.api';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  'All',
  'SPLUNK',
  'SENTINEL',
  'CHRONICLE',
  'ELASTIC',
  'QRADAR',
  'SIGMA',
  'CUSTOM',
] as const;
const ALL_SEVERITIES = ['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const ALL_PLATFORM_OPTIONS: DetectionPlatform[] = [
  'SPLUNK',
  'SENTINEL',
  'CHRONICLE',
  'ELASTIC',
  'QRADAR',
  'DEFENDER',
  'SIGMA',
  'CUSTOM',
];
const ALL_SEVERITY_OPTIONS: DetectionSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const ALL_LANG_OPTIONS: QueryLanguage[] = ['SPL', 'KQL', 'YARA_L', 'EQL', 'AQL', 'SIGMA', 'CUSTOM'];

const PLATFORM_QUERY_LANG: Partial<Record<DetectionPlatform, QueryLanguage>> = {
  SPLUNK: 'SPL',
  SENTINEL: 'KQL',
  CHRONICLE: 'YARA_L',
  ELASTIC: 'EQL',
  QRADAR: 'AQL',
  SIGMA: 'SIGMA',
  CUSTOM: 'CUSTOM',
};

// ── Blank form ─────────────────────────────────────────────────────────────────

const BLANK_FORM: CreateDetectionPayload = {
  name: '',
  description: '',
  severity: 'HIGH',
  platform: 'SPLUNK',
  query: '',
  queryLanguage: 'SPL',
  mitreAttackId: '',
  mitreTactic: '',
  mitreTechnique: '',
  nistControls: [],
  dataSources: [],
  tags: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DetectionsPage() {
  const [detections, setDetections] = useState<DetectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [tactic, setTactic] = useState('All');
  const [showEnabled, setShowEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Detail panel
  const [selected, setSelected] = useState<DetectionRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Toggle loading map: detectionId -> boolean
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // New detection modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState<CreateDetectionPayload>(BLANK_FORM);
  const [nistInput, setNistInput] = useState('');
  const [dsInput, setDsInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (platform !== 'All') params['platform'] = platform;
      if (severity !== 'All') params['severity'] = severity;
      if (search) params['search'] = search;
      if (tactic !== 'All') params['tactic'] = tactic;
      if (showEnabled === 'enabled') params['enabled'] = 'true';
      if (showEnabled === 'disabled') params['enabled'] = 'false';
      const data = await detectionsApi.list(params as Parameters<typeof detectionsApi.list>[0]);
      setDetections(data);
    } catch {
      setError('Failed to load detections. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [platform, severity, search, tactic, showEnabled]);

  useEffect(() => {
    void fetchDetections();
  }, [fetchDetections]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const allTactics = [
    'All',
    ...(Array.from(new Set(detections.map((d) => d.mitreTactic).filter(Boolean))) as string[]),
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggle = async (det: DetectionRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling[det.id]) return;
    setToggling((prev) => ({ ...prev, [det.id]: true }));
    try {
      await detectionsApi.toggle(det.id, !det.isEnabled);
      setDetections((prev) =>
        prev.map((d) => (d.id === det.id ? { ...d, isEnabled: !d.isEnabled } : d)),
      );
      if (selected?.id === det.id) {
        setSelected((s) => (s ? { ...s, isEnabled: !s.isEnabled } : s));
      }
    } catch {
      // Silently fail — refetch will correct state
      void fetchDetections();
    } finally {
      setToggling((prev) => ({ ...prev, [det.id]: false }));
    }
  };

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlatformChange = (p: DetectionPlatform) => {
    const lang = PLATFORM_QUERY_LANG[p] ?? 'CUSTOM';
    setForm((f) => ({ ...f, platform: p, queryLanguage: lang }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const payload: CreateDetectionPayload = {
        ...form,
        nistControls: nistInput
          ? nistInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        dataSources: dsInput
          ? dsInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        tags: tagsInput
          ? tagsInput
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        mitreAttackId: form.mitreAttackId || undefined,
        mitreTactic: form.mitreTactic || undefined,
        mitreTechnique: form.mitreTechnique || undefined,
      };
      const created = await detectionsApi.create(payload);
      setDetections((prev) => [created, ...prev]);
      setShowNewModal(false);
      setForm(BLANK_FORM);
      setNistInput('');
      setDsInput('');
      setTagsInput('');
      setSelected(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create detection';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await detectionsApi.importFile(importFile);
      setImportResult(result);
      if (result.imported > 0) {
        void fetchDetections();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setImportResult({ imported: 0, skipped: 0, errors: [msg] });
    } finally {
      setImporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Detection Library" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: list ───────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex flex-col min-h-0 overflow-hidden border-r border-black/10 dark:border-white/10',
            selected ? 'w-[55%]' : 'flex-1',
          )}
        >
          {/* Toolbar */}
          <div className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search detections, technique IDs, descriptions..."
                  className="flex-1 bg-transparent text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Import
              </button>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors shadow-sm shadow-amber-500/20"
              >
                <Plus className="h-3.5 w-3.5" /> New Detection
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <FilterSelect
                label="Platform"
                value={platform}
                options={ALL_PLATFORMS as unknown as string[]}
                display={(v) =>
                  v === 'All' ? 'Platform: All' : (PLATFORM_LABEL[v as DetectionPlatform] ?? v)
                }
                onChange={setPlatform}
              />
              <FilterSelect
                label="Severity"
                value={severity}
                options={ALL_SEVERITIES as unknown as string[]}
                display={(v) =>
                  v === 'All' ? 'Severity: All' : (SEVERITY_LABEL[v as DetectionSeverity] ?? v)
                }
                onChange={setSeverity}
              />
              <FilterSelect
                label="Tactic"
                value={tactic}
                options={allTactics}
                display={(v) => (v === 'All' ? 'Tactic: All' : v)}
                onChange={setTactic}
              />
              <FilterSelect
                label="Status"
                value={showEnabled}
                options={['all', 'enabled', 'disabled']}
                display={(v) =>
                  ({ all: 'Status: All', enabled: 'Enabled', disabled: 'Disabled' })[v] ?? v
                }
                onChange={(v) => setShowEnabled(v as 'all' | 'enabled' | 'disabled')}
              />
              <button
                type="button"
                onClick={() => void fetchDetections()}
                className="ml-auto p-1.5 rounded text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
              <span className="text-xs text-slate-400 dark:text-zinc-500">
                {loading ? '...' : `${detections.length} rules`}
              </span>
            </div>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-sm text-slate-500 dark:text-zinc-400">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void fetchDetections()}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : loading && detections.length === 0 ? (
              <div className="flex flex-col gap-1 p-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : detections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-sm text-slate-500 dark:text-zinc-400">
                <Shield className="h-8 w-8 opacity-30" />
                <p>No detections found</p>
                <p className="text-xs">Try adjusting your filters or create a custom rule</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white/90 dark:bg-black/40 backdrop-blur-md border-b border-black/10 dark:border-white/10">
                  <tr>
                    {['', 'On', 'Detection', 'Platform', 'Severity', 'FP%', 'Alerts/d'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {detections.map((det) => (
                    <tr
                      key={det.id}
                      onClick={() => setSelected(det.id === selected?.id ? null : det)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selected?.id === det.id
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-l-2 border-l-amber-500'
                          : 'hover:bg-black/5 dark:hover:bg-white/5',
                      )}
                    >
                      <td className="px-3 py-3">
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 transition-transform',
                            selected?.id === det.id &&
                              'rotate-90 text-amber-500 dark:text-amber-400',
                          )}
                        />
                      </td>

                      {/* Enable / disable toggle */}
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => void handleToggle(det, e)}
                          disabled={toggling[det.id]}
                          title={det.isEnabled ? 'Disable detection' : 'Enable detection'}
                          className={cn(
                            'transition-colors rounded',
                            toggling[det.id] && 'opacity-50 cursor-wait',
                          )}
                        >
                          {det.isEnabled ? (
                            <ToggleRight className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-slate-300 dark:text-zinc-600" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-3 max-w-[200px]">
                        <p className="font-medium text-slate-900 dark:text-white text-xs truncate">
                          {det.name}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                          {det.ruleId}
                          {det.isCustom && (
                            <span className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1 text-[9px] font-bold">
                              CUSTOM
                            </span>
                          )}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            PLATFORM_COLORS[det.platform],
                          )}
                        >
                          {PLATFORM_LABEL[det.platform]}
                        </span>
                        {det.mitreAttackId && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            {det.mitreAttackId}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold',
                            SEVERITY_COLORS[det.severity],
                          )}
                        >
                          {SEVERITY_LABEL[det.severity]}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-xs font-medium">
                        {det.stats.triggerCount > 0 ? (
                          <span
                            className={cn(
                              det.stats.falsePositives / (det.stats.triggerCount || 1) > 0.2
                                ? 'text-red-500 dark:text-red-400'
                                : det.stats.falsePositives / (det.stats.triggerCount || 1) > 0.1
                                  ? 'text-amber-500 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {det.stats.triggerCount > 0
                              ? `${Math.round((det.stats.falsePositives / det.stats.triggerCount) * 100)}%`
                              : det.expectedFpRate != null
                                ? `${det.expectedFpRate}%`
                                : '-'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-zinc-600">
                            {det.expectedFpRate != null ? `~${det.expectedFpRate}%` : '-'}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs text-slate-700 dark:text-zinc-300">
                        {det.stats.triggerCount > 0 ? (
                          det.stats.triggerCount
                        ) : (
                          <span className="text-slate-300 dark:text-zinc-600">
                            {det.expectedAlertsPerDay != null
                              ? `~${det.expectedAlertsPerDay}`
                              : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: detail panel ──────────────────────────────────────── */}
        {selected && (
          <div className="w-[45%] flex flex-col overflow-hidden bg-black/5 dark:bg-black/20 backdrop-blur-md">
            <div className="border-b border-black/10 dark:border-white/10 px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                    {selected.ruleId}
                    {selected.isCustom && (
                      <span className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[9px] font-bold">
                        CUSTOM
                      </span>
                    )}
                  </p>
                  <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {selected.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => void handleToggle(selected, e)}
                    disabled={toggling[selected.id]}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors border',
                      selected.isEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : 'bg-slate-50 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10',
                    )}
                  >
                    {selected.isEnabled ? (
                      <ToggleRight className="h-3.5 w-3.5" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5" />
                    )}
                    {selected.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white text-lg leading-none"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-bold',
                    SEVERITY_COLORS[selected.severity],
                  )}
                >
                  {SEVERITY_LABEL[selected.severity]}
                </span>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-semibold',
                    PLATFORM_COLORS[selected.platform],
                  )}
                >
                  {PLATFORM_LABEL[selected.platform]}
                </span>
                {selected.mitreAttackId && (
                  <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {selected.mitreAttackId}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                {selected.description}
              </p>

              {/* Analytics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Triggers (30d)',
                    value:
                      selected.stats.triggerCount > 0
                        ? selected.stats.triggerCount
                        : selected.expectedAlertsPerDay != null
                          ? `~${selected.expectedAlertsPerDay}/d`
                          : '-',
                    color: 'text-slate-900 dark:text-white',
                  },
                  {
                    label: 'FP Rate',
                    value:
                      selected.stats.triggerCount > 0
                        ? `${Math.round((selected.stats.falsePositives / selected.stats.triggerCount) * 100)}%`
                        : selected.expectedFpRate != null
                          ? `~${selected.expectedFpRate}%`
                          : '-',
                    color:
                      selected.stats.triggerCount > 0 &&
                      selected.stats.falsePositives / selected.stats.triggerCount > 0.2
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    label: 'MTTD',
                    value:
                      selected.expectedMttdHours != null ? `${selected.expectedMttdHours}h` : '-',
                    color: 'text-amber-600 dark:text-amber-400',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 text-center"
                  >
                    <p className={cn('text-lg font-bold', m.color)}>{String(m.value)}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* MITRE */}
              {(selected.mitreTactic || selected.mitreAttackId) && (
                <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    MITRE ATT&amp;CK
                  </p>
                  <p className="text-xs font-medium text-slate-900 dark:text-white">
                    {selected.mitreTactic}
                    {selected.mitreAttackId && (
                      <>
                        {' - '}
                        <span className="text-amber-600 dark:text-amber-400">
                          {selected.mitreAttackId}
                        </span>
                      </>
                    )}
                  </p>
                  {selected.mitreTechnique && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {selected.mitreTechnique}
                    </p>
                  )}
                </div>
              )}

              {/* TP / FP stats */}
              {selected.stats.triggerCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Triggers',
                      value: selected.stats.triggerCount,
                      color: 'text-slate-900 dark:text-white',
                    },
                    {
                      label: 'True Positives',
                      value: selected.stats.truePositives,
                      color: 'text-emerald-600 dark:text-emerald-400',
                    },
                    {
                      label: 'False Positives',
                      value: selected.stats.falsePositives,
                      color: 'text-red-500 dark:text-red-400',
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-2.5 text-center"
                    >
                      <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
                      <p className="text-[9px] text-slate-400 dark:text-zinc-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* NIST */}
              {selected.nistControls.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    NIST 800-53 Controls
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selected.nistControls.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-2 py-0.5 text-[11px] text-slate-600 dark:text-zinc-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data sources */}
              {selected.dataSources.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    Data Sources Required
                  </p>
                  <ul className="space-y-1">
                    {selected.dataSources.map((ds) => (
                      <li
                        key={ds}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400"
                      >
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-600" /> {ds}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Query */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    {QUERY_LANG_LABEL[selected.queryLanguage]} Query
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 border border-black/10 dark:border-white/10 p-4 text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap">
                  {selected.query}
                </pre>
              </div>

              {/* Tags */}
              {selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-500 dark:text-zinc-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-4 text-[10px] text-slate-400 dark:text-zinc-500 border-t border-black/10 dark:border-white/10 pt-3">
                <span>Created {new Date(selected.createdAt).toLocaleDateString()}</span>
                <span>Updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Detection Modal ───────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                New Custom Detection
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowNewModal(false);
                  setCreateError(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {createError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Rule Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Suspicious PowerShell Activity"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50 dark:focus:border-amber-500/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Describe what this rule detects and why it matters"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50 dark:focus:border-amber-500/50 resize-none"
                />
              </div>

              {/* Platform + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Platform <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) => handlePlatformChange(e.target.value as DetectionPlatform)}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  >
                    {ALL_PLATFORM_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Severity <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, severity: e.target.value as DetectionSeverity }))
                    }
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  >
                    {ALL_SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Query Language */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Query Language <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.queryLanguage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, queryLanguage: e.target.value as QueryLanguage }))
                  }
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                >
                  {ALL_LANG_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {QUERY_LANG_LABEL[l]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Query */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Detection Query <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.query}
                  onChange={(e) => setForm((f) => ({ ...f, query: e.target.value }))}
                  rows={5}
                  placeholder={`Paste your ${QUERY_LANG_LABEL[form.queryLanguage]} query here...`}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-900 px-3 py-2 text-sm text-emerald-400 outline-none focus:border-amber-500/50 font-mono resize-none"
                />
              </div>

              {/* MITRE */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    MITRE ID
                  </label>
                  <input
                    value={form.mitreAttackId ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, mitreAttackId: e.target.value }))}
                    placeholder="T1059.001"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Tactic
                  </label>
                  <input
                    value={form.mitreTactic ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, mitreTactic: e.target.value }))}
                    placeholder="Execution"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Technique
                  </label>
                  <input
                    value={form.mitreTechnique ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, mitreTechnique: e.target.value }))}
                    placeholder="PowerShell"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* NIST + Data sources + Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    NIST Controls{' '}
                    <span className="font-normal text-slate-400">(comma-separated)</span>
                  </label>
                  <input
                    value={nistInput}
                    onChange={(e) => setNistInput(e.target.value)}
                    placeholder="SI-3, SI-4, AU-2"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Data Sources{' '}
                    <span className="font-normal text-slate-400">(comma-separated)</span>
                  </label>
                  <input
                    value={dsInput}
                    onChange={(e) => setDsInput(e.target.value)}
                    placeholder="Windows Event Logs, Sysmon"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Tags <span className="font-normal text-slate-400">(comma-separated)</span>
                </label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="powershell, obfuscation, windows"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewModal(false);
                  setCreateError(null);
                }}
                className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || !form.name || !form.query}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Detection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Import Detections
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Format note */}
              <div className="rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Format
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Required columns:{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    name
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    query
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    platform
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    queryLanguage
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    severity
                  </code>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Optional:{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    description
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    mitreAttackId
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    mitreTactic
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    nistControls
                  </code>
                  ,{' '}
                  <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-[11px]">
                    tags
                  </code>
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  Platforms: SPLUNK, SENTINEL, CHRONICLE, ELASTIC, QRADAR, SIGMA, CUSTOM
                  <br />
                  Severities: CRITICAL, HIGH, MEDIUM, LOW, INFO
                </p>
              </div>

              {/* File picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
                  importFile
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                    : 'border-black/10 dark:border-white/10 hover:border-amber-400/50',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setImportFile(f);
                      setImportResult(null);
                    }
                  }}
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
                {importFile ? (
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {importFile.name}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Click to choose Excel file
                    </p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      .xlsx or .xls, max 500 rows
                    </p>
                  </>
                )}
              </div>

              {/* Result */}
              {importResult && (
                <div
                  className={cn(
                    'rounded-lg border p-4 space-y-2',
                    importResult.errors.length === 0
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {importResult.imported} detection{importResult.imported !== 1 ? 's' : ''}{' '}
                    imported
                    {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                  </p>
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      {e}
                    </p>
                  ))}
                  {importResult.errors.length > 5 && (
                    <p className="text-xs text-slate-500">
                      ...and {importResult.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-black/10 dark:border-white/10 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {importResult?.imported ? 'Done' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={!importFile || importing}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Select ─────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  display,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  display: (v: string) => string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md pl-3 pr-7 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:border-amber-500/50 focus:outline-none cursor-pointer"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {display(o)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-zinc-500" />
    </div>
  );
}
