'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import {
  ChevronDown,
  ShieldCheck,
  Target,
  AlertTriangle,
  Clock,
  Users,
  Plug,
  TrendingUp,
  ArrowUpRight,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutDashboard,
  Briefcase,
  PieChart,
  Sliders,
  GripVertical,
  Database,
  Activity,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  detectionsApi,
  type DashboardSummary,
  type DetectionPlatform,
  PLATFORM_LABEL,
  PLATFORM_COLORS,
  SEVERITY_COLORS,
  SEVERITY_LABEL,
  type DetectionSeverity,
} from '@/lib/detections.api';
import { integrationsApi, type IntegrationRow } from '@/lib/integrations.api';
import { huntsApi, type THaaSStats } from '@/lib/hunts.api';
import { ATTACK_MATRIX } from '@/data/attack-matrix';

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardView =
  | 'ciso'
  | 'soc-manager'
  | 'detection-analytics'
  | 'soc-command-center'
  | 'custom';

const DASHBOARD_OPTIONS: {
  value: DashboardView;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: 'ciso',
    label: 'CISO Dashboard',
    icon: Briefcase,
    description: 'Executive risk posture & board-ready metrics',
  },
  {
    value: 'soc-manager',
    label: 'SOC Manager Dashboard',
    icon: Users,
    description: 'Operational overview for SOC leadership',
  },
  {
    value: 'detection-analytics',
    label: 'Detection Analytics',
    icon: PieChart,
    description: 'Rule performance, FP rates & coverage depth',
  },
  {
    value: 'soc-command-center',
    label: 'SOC Command Center',
    icon: LayoutDashboard,
    description: 'Real-time defensive posture & alert stream',
  },
  {
    value: 'custom',
    label: 'Custom Dashboard',
    icon: Sliders,
    description: 'Build your own with pre-defined widgets & queries',
  },
];

// ── Query validation ──────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bALTER\s+(TABLE|DATABASE)\b/i,
  /\bCREATE\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bEXEC\s*\(/i,
  /\bxp_\w+/i,
  /;\s*DROP/i,
  /--\s*DROP/i,
  /UNION\s+SELECT/i,
];

type ValidationResult = { valid: boolean; error?: string };

function validateQuery(query: string): ValidationResult {
  const trimmed = query.trim();
  if (!trimmed) return { valid: false, error: 'Query cannot be empty.' };
  if (trimmed.length < 5) return { valid: false, error: 'Query is too short.' };
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        error: 'Query contains a forbidden operation. Only read operations are permitted.',
      };
    }
  }
  return { valid: true };
}

// ── Pre-defined widget catalogue ──────────────────────────────────────────────

type PresetWidgetType =
  | 'detection-count'
  | 'mitre-coverage'
  | 'active-integrations'
  | 'active-hunts'
  | 'high-severity-count'
  | 'avg-fp-rate';

interface PresetWidget {
  id: string;
  type: 'preset';
  preset: PresetWidgetType;
}

interface QueryWidget {
  id: string;
  type: 'query';
  label: string;
  query: string;
  queryLang: 'KQL' | 'SPL' | 'Custom';
  validation: ValidationResult | null;
}

type DashboardWidget = PresetWidget | QueryWidget;

const PRESET_CATALOGUE: {
  type: PresetWidgetType;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    type: 'detection-count',
    label: 'Active Detections',
    icon: ShieldCheck,
    color: 'text-amber-500',
  },
  { type: 'mitre-coverage', label: 'MITRE Coverage %', icon: Target, color: 'text-emerald-500' },
  { type: 'active-integrations', label: 'Active Integrations', icon: Plug, color: 'text-teal-500' },
  { type: 'active-hunts', label: 'Active Hunt Missions', icon: Activity, color: 'text-purple-500' },
  {
    type: 'high-severity-count',
    label: 'High/Critical Rules',
    icon: AlertTriangle,
    color: 'text-red-500',
  },
  { type: 'avg-fp-rate', label: 'Avg. FP Rate', icon: TrendingUp, color: 'text-orange-500' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCoverage(techniqueCountMap: Record<string, number>) {
  let total = 0;
  let covered = 0;
  for (const tactic of ATTACK_MATRIX) {
    for (const tech of tactic.techniques) {
      total++;
      const count = Object.entries(techniqueCountMap)
        .filter(([id]) => id.startsWith(tech.id))
        .reduce((s, [, c]) => s + c, 0);
      if (count > 0) covered++;
    }
  }
  return { total, covered, pct: total > 0 ? Math.round((covered / total) * 100) : 0 };
}

let widgetCounter = 0;
function uid() {
  return `w-${++widgetCounter}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardsPage() {
  const [view, setView] = useState<DashboardView>('ciso');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [huntStats, setHuntStats] = useState<THaaSStats | null>(null);
  const [loading, setLoading] = useState(true);

  const currentOption = DASHBOARD_OPTIONS.find((o) => o.value === view)!;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ints, hs] = await Promise.all([
        detectionsApi.summary(),
        integrationsApi.list(),
        huntsApi.stats(),
      ]);
      setSummary(s);
      setIntegrations(ints);
      setHuntStats(hs);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const connectedIntegrations = integrations.filter((i) => i.status === 'CONNECTED' && i.isEnabled);
  const coverage = summary ? computeCoverage(summary.techniqueCountMap) : null;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <Header title="Dashboards" />

      {/* ── Dashboard selector bar ──────────────────────────────────────────── */}
      <div className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 px-6 py-3 shrink-0 flex items-center gap-4">
        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">View:</span>

        {/* Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm"
          >
            <currentOption.icon className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            {currentOption.label}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-slate-400 transition-transform',
                dropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 shadow-xl overflow-hidden">
              {DASHBOARD_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = opt.value === view;
                if (opt.value === 'soc-command-center') {
                  return (
                    <Link
                      key={opt.value}
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-0"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-slate-400 dark:text-zinc-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {opt.description}
                        </p>
                      </div>
                      <ArrowUpRight className="h-3 w-3 ml-auto mt-0.5 text-slate-300 dark:text-zinc-600 shrink-0" />
                    </Link>
                  );
                }
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setView(opt.value);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-0',
                      isActive && 'bg-blue-50 dark:bg-blue-500/10',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 mt-0.5 shrink-0',
                        isActive ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-400',
                      )}
                    />
                    <div className="text-left">
                      <p
                        className={cn(
                          'text-xs font-semibold',
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-zinc-200',
                        )}
                      >
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {opt.description}
                      </p>
                    </div>
                    {isActive && (
                      <CheckCircle2 className="h-3.5 w-3.5 ml-auto mt-0.5 text-blue-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-zinc-500 hidden sm:block">
          {currentOption.description}
        </p>
      </div>

      {/* ── Dashboard content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {view === 'ciso' && (
          <CISODashboard
            loading={loading}
            summary={summary}
            coverage={coverage}
            huntStats={huntStats}
            connectedIntegrations={connectedIntegrations}
          />
        )}
        {view === 'soc-manager' && (
          <SOCManagerDashboard
            loading={loading}
            summary={summary}
            coverage={coverage}
            huntStats={huntStats}
            connectedIntegrations={connectedIntegrations}
            integrations={integrations}
          />
        )}
        {view === 'detection-analytics' && (
          <DetectionAnalyticsDashboard loading={loading} summary={summary} />
        )}
        {view === 'custom' && (
          <CustomDashboard
            loading={loading}
            summary={summary}
            connectedIntegrations={connectedIntegrations}
            huntStats={huntStats}
            coverage={coverage}
          />
        )}
      </main>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-3 right-3 opacity-10">
        <Icon className={cn('h-10 w-10', iconColor)} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1.5">{value}</p>
      <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{sub}</p>
      {badge && (
        <span
          className={cn(
            'mt-2 inline-flex text-[10px] px-1.5 py-0.5 rounded border font-semibold',
            badgeColor,
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm space-y-4',
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-[10px] text-slate-400 dark:text-zinc-400 truncate shrink-0 text-right pr-1">
        {label}
      </div>
      <div className="flex-1 bg-black/5 dark:bg-white/5 rounded h-5 flex items-center px-1 overflow-hidden">
        <div
          className={cn('h-3.5 rounded transition-all duration-500', colorClass)}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 1)}%` }}
        />
        {value > 0 && (
          <span className="text-[9px] font-bold text-slate-700 dark:text-white pl-1.5">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ── CISO Dashboard ────────────────────────────────────────────────────────────

function CISODashboard({
  loading,
  summary,
  coverage,
  huntStats,
  connectedIntegrations,
}: {
  loading: boolean;
  summary: DashboardSummary | null;
  coverage: { total: number; covered: number; pct: number } | null;
  huntStats: THaaSStats | null;
  connectedIntegrations: IntegrationRow[];
}) {
  const tacticGaps = summary
    ? ATTACK_MATRIX.filter((t) =>
        t.techniques.every(
          (tech) => !Object.keys(summary.techniqueCountMap).some((id) => id.startsWith(tech.id)),
        ),
      ).length
    : 0;

  const criticalCount = summary
    ? Object.entries(summary.bySeverity).reduce(
        (s, [sev, c]) => (sev === 'CRITICAL' ? s + c : s),
        0,
      )
    : 0;

  const riskScore = coverage
    ? Math.max(0, Math.round(100 - tacticGaps * 5 - (100 - coverage.pct) * 0.4))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            CISO Executive Dashboard
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            Board-ready security posture overview ·{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/coverage"
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
        >
          <Target className="h-3.5 w-3.5" /> Coverage Navigator <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi
          label="Security Risk Score"
          value={loading ? '—' : riskScore != null ? `${riskScore}/100` : '—'}
          sub="Composite posture index"
          icon={ShieldCheck}
          iconColor="text-blue-400"
          badge={
            riskScore != null
              ? riskScore >= 75
                ? 'GOOD'
                : riskScore >= 50
                  ? 'MODERATE'
                  : 'HIGH RISK'
              : undefined
          }
          badgeColor={
            riskScore != null
              ? riskScore >= 75
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : riskScore >= 50
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
              : undefined
          }
        />
        <Kpi
          label="ATT&CK Coverage"
          value={loading ? '—' : `${coverage?.pct ?? 0}%`}
          sub={`${coverage?.covered ?? 0} of ${coverage?.total ?? 0} techniques`}
          icon={Target}
          iconColor="text-amber-400"
          badge="Goal: >80%"
          badgeColor="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
        <Kpi
          label="Tactic Coverage Gaps"
          value={loading ? '—' : String(tacticGaps)}
          sub="MITRE tactics with zero coverage"
          icon={AlertTriangle}
          iconColor="text-red-400"
          badge={tacticGaps === 0 ? 'NONE' : `${tacticGaps} gaps`}
          badgeColor={
            tacticGaps === 0
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
          }
        />
        <Kpi
          label="Critical Rules Active"
          value={loading ? '—' : String(criticalCount)}
          sub={`of ${summary?.totalDetections ?? 0} total detections`}
          icon={AlertTriangle}
          iconColor="text-orange-400"
          badge="CRITICAL"
          badgeColor="text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ATT&CK tactic coverage */}
        <SectionCard title="MITRE ATT&CK Tactic Coverage" className="lg:col-span-2">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {ATTACK_MATRIX.map((tactic) => {
                const covered = summary
                  ? tactic.techniques.filter((t) =>
                      Object.keys(summary.techniqueCountMap).some((id) => id.startsWith(t.id)),
                    ).length
                  : 0;
                const pct = Math.round((covered / tactic.techniques.length) * 100);
                return (
                  <div key={tactic.id} className="flex items-center gap-2">
                    <div className="w-20 text-[9px] text-slate-400 dark:text-zinc-400 truncate shrink-0 text-right">
                      {tactic.shortName}
                    </div>
                    <div className="flex-1 bg-black/5 dark:bg-white/5 rounded h-4 flex items-center px-0.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-3 rounded transition-all duration-500',
                          pct > 60
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                            : covered > 0
                              ? 'bg-amber-400'
                              : 'bg-red-400/50',
                        )}
                        style={{ width: `${Math.max(pct, covered > 0 ? 5 : 2)}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 w-7 text-right">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Risk summary */}
        <div className="space-y-4">
          <SectionCard title="Security Posture Summary">
            {loading ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    label: 'Active Detection Rules',
                    value: summary?.enabledDetections ?? 0,
                    total: summary?.totalDetections ?? 0,
                    color: 'bg-emerald-500',
                  },
                  {
                    label: 'Rules Deployed to SIEM',
                    value: summary?.deployedDetections ?? 0,
                    total: summary?.totalDetections ?? 0,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Active SIEM Integrations',
                    value: connectedIntegrations.length,
                    total: null,
                    color: 'bg-teal-500',
                  },
                  {
                    label: 'Active Hunt Missions',
                    value: huntStats?.active ?? 0,
                    total: huntStats?.total ?? null,
                    color: 'bg-purple-500',
                  },
                ].map(({ label, value, total, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-zinc-400">{label}</span>
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {value}
                        {total !== null ? ` / ${total}` : ''}
                      </span>
                    </div>
                    {total !== null && (
                      <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', color)}
                          style={{ width: `${total > 0 ? Math.round((value / total) * 100) : 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Severity Distribution">
            {loading ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
            ) : (
              <div className="space-y-2">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as DetectionSeverity[]).map(
                  (sev) => {
                    const count = summary?.bySeverity[sev] ?? 0;
                    const total = summary
                      ? Object.values(summary.bySeverity).reduce((s, c) => s + c, 0)
                      : 0;
                    return (
                      <div key={sev} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[9px] font-bold rounded px-1.5 py-0.5 w-14 text-center shrink-0',
                            SEVERITY_COLORS[sev],
                          )}
                        >
                          {SEVERITY_LABEL[sev]}
                        </span>
                        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded h-3.5 overflow-hidden">
                          <div
                            className="h-full bg-slate-300 dark:bg-white/30 rounded transition-all duration-500"
                            style={{
                              width: `${total > 0 ? Math.round((count / total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 w-5 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ── SOC Manager Dashboard ─────────────────────────────────────────────────────

function SOCManagerDashboard({
  loading,
  summary,
  coverage,
  huntStats,
  connectedIntegrations,
  integrations,
}: {
  loading: boolean;
  summary: DashboardSummary | null;
  coverage: { total: number; covered: number; pct: number } | null;
  huntStats: THaaSStats | null;
  connectedIntegrations: IntegrationRow[];
  integrations: IntegrationRow[];
}) {
  const enablementRate =
    summary && summary.totalDetections > 0
      ? Math.round((summary.enabledDetections / summary.totalDetections) * 100)
      : 0;

  const deploymentRate =
    summary && summary.totalDetections > 0
      ? Math.round((summary.deployedDetections / summary.totalDetections) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            SOC Manager Dashboard
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            Operational status · Team & platform health overview
          </p>
        </div>
        <Link
          href="/thaas/missions"
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
        >
          <Activity className="h-3.5 w-3.5" /> Hunt Missions <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi
          label="Enabled Rules"
          value={loading ? '—' : String(summary?.enabledDetections ?? 0)}
          sub={`${enablementRate}% enablement rate`}
          icon={ShieldCheck}
          iconColor="text-emerald-400"
          badge={`${summary?.totalDetections ?? 0} total`}
          badgeColor="text-slate-600 dark:text-zinc-300 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
        />
        <Kpi
          label="Deployed to SIEM"
          value={loading ? '—' : String(summary?.deployedDetections ?? 0)}
          sub={`${deploymentRate}% deployment rate`}
          icon={Database}
          iconColor="text-blue-400"
          badge="Active in SIEM"
          badgeColor="text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
        />
        <Kpi
          label="SIEM Integrations"
          value={loading ? '—' : String(connectedIntegrations.length)}
          sub={`of ${integrations.length} configured`}
          icon={Plug}
          iconColor="text-teal-400"
          badge={connectedIntegrations.length > 0 ? 'Connected' : 'None'}
          badgeColor={
            connectedIntegrations.length > 0
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
          }
        />
        <Kpi
          label="ATT&CK Coverage"
          value={loading ? '—' : `${coverage?.pct ?? 0}%`}
          sub={`${coverage?.covered ?? 0} / ${coverage?.total ?? 0} techniques`}
          icon={Target}
          iconColor="text-amber-400"
          badge="Goal: >80%"
          badgeColor="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Platform breakdown */}
        <SectionCard title="Detections by Platform">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(summary?.byPlatform ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([platform, count]) => (
                  <div key={platform} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[9px] font-bold rounded px-1.5 py-0.5 w-24 text-center shrink-0 truncate',
                        PLATFORM_COLORS[platform as DetectionPlatform] ??
                          'bg-slate-100 dark:bg-white/10 text-slate-500',
                      )}
                    >
                      {PLATFORM_LABEL[platform as DetectionPlatform] ?? platform}
                    </span>
                    <div className="flex-1 bg-black/5 dark:bg-white/5 rounded h-4 flex items-center px-1 overflow-hidden">
                      <div
                        className="h-3 bg-blue-400/60 dark:bg-blue-500/60 rounded transition-all duration-500"
                        style={{
                          width: `${Math.max(Math.round((count / (summary?.totalDetections ?? 1)) * 100), 2)}%`,
                        }}
                      />
                      <span className="text-[9px] font-bold text-slate-600 dark:text-zinc-300 pl-1.5">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              {Object.keys(summary?.byPlatform ?? {}).length === 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">
                  No detections yet.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Hunt missions */}
        <SectionCard title="Hunt Mission Status">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: 'Total Missions',
                  value: huntStats?.total ?? 0,
                  color: 'bg-slate-400 dark:bg-zinc-500',
                },
                {
                  label: 'Active',
                  value: huntStats?.active ?? 0,
                  color: 'bg-emerald-500 animate-pulse',
                },
                { label: 'Completed', value: huntStats?.complete ?? 0, color: 'bg-blue-400' },
                {
                  label: 'Total Evidence',
                  value: huntStats?.evidenceCount ?? 0,
                  color: 'bg-purple-400',
                },
                { label: 'Total IOCs', value: huntStats?.iocCount ?? 0, color: 'bg-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', color)} />
                    <span className="text-xs text-slate-500 dark:text-zinc-400">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{value}</span>
                </div>
              ))}
              <Link
                href="/thaas/missions"
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline mt-2"
              >
                View all missions <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Recent detections */}
        <SectionCard title="Recent Detection Updates">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-2.5">
              {(summary?.recentDetections ?? []).slice(0, 6).map((det) => (
                <div key={det.id} className="flex items-start gap-2">
                  <div
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center rounded text-[8px] font-bold',
                      det.isEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700/40',
                    )}
                  >
                    {det.isEnabled ? '✓' : '○'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-white line-clamp-1">
                      {det.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      {det.ruleId} · {det.mitreAttackId ?? '—'}
                    </p>
                  </div>
                </div>
              ))}
              {(summary?.recentDetections ?? []).length === 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">
                  No detections yet.
                </p>
              )}
              <Link
                href="/detections"
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Full detection library <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Tactic breakdown */}
      <SectionCard title="Tactic Coverage Breakdown">
        {loading ? (
          <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ATTACK_MATRIX.map((tactic) => {
              const covered = summary
                ? tactic.techniques.filter((t) =>
                    Object.keys(summary.techniqueCountMap).some((id) => id.startsWith(t.id)),
                  ).length
                : 0;
              const pct = Math.round((covered / tactic.techniques.length) * 100);
              return (
                <div
                  key={tactic.id}
                  className="p-3 rounded-lg border border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300 truncate">
                      {tactic.shortName}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold',
                        pct > 60
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : covered > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-500 dark:text-red-400',
                      )}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        pct > 60 ? 'bg-emerald-500' : covered > 0 ? 'bg-amber-500' : 'bg-red-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-1">
                    {covered}/{tactic.techniques.length} techniques
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Detection Analytics Dashboard ─────────────────────────────────────────────

function DetectionAnalyticsDashboard({
  loading,
  summary,
}: {
  loading: boolean;
  summary: DashboardSummary | null;
}) {
  const platformEntries = Object.entries(summary?.byPlatform ?? {}).sort(([, a], [, b]) => b - a);
  const tacticEntries = Object.entries(summary?.byTactic ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const maxPlatform = platformEntries[0]?.[1] ?? 1;
  const maxTactic = tacticEntries[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-black/10 dark:border-white/10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Detection Analytics</h2>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
          Rule performance, false positive rates & coverage depth
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi
          label="Total Detections"
          value={loading ? '—' : String(summary?.totalDetections ?? 0)}
          sub={`${summary?.enabledDetections ?? 0} active`}
          icon={ShieldCheck}
          iconColor="text-amber-400"
        />
        <Kpi
          label="Avg. FP Rate"
          value={
            loading ? '—' : summary?.avgFpRate != null ? `${summary.avgFpRate.toFixed(1)}%` : 'N/A'
          }
          sub="Target: below 5%"
          icon={TrendingUp}
          iconColor="text-orange-400"
          badge={
            summary?.avgFpRate != null ? (summary.avgFpRate < 5 ? 'ON TARGET' : 'HIGH') : undefined
          }
          badgeColor={
            summary?.avgFpRate != null
              ? summary.avgFpRate < 5
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
              : undefined
          }
        />
        <Kpi
          label="Avg. MTTD"
          value={
            loading
              ? '—'
              : summary?.avgMttdHours != null
                ? `${summary.avgMttdHours.toFixed(1)}h`
                : 'N/A'
          }
          sub="Mean time to detect"
          icon={Clock}
          iconColor="text-purple-400"
          badge="Target: <1h"
          badgeColor="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
        <Kpi
          label="Expected Alerts/Day"
          value={
            loading
              ? '—'
              : summary?.totalAlertsPerDay != null
                ? summary.totalAlertsPerDay.toFixed(0)
                : 'N/A'
          }
          sub="Across all active rules"
          icon={Activity}
          iconColor="text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform breakdown */}
        <SectionCard title="Detections by Platform">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : platformEntries.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
              No data yet.
            </p>
          ) : (
            <div className="space-y-2">
              {platformEntries.map(([platform, count]) => (
                <BarRow
                  key={platform}
                  label={PLATFORM_LABEL[platform as DetectionPlatform] ?? platform}
                  value={count}
                  max={maxPlatform}
                  colorClass="bg-gradient-to-r from-blue-500 to-blue-400"
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Severity breakdown */}
        <SectionCard title="Detections by Severity">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-3">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as DetectionSeverity[]).map((sev) => {
                const count = summary?.bySeverity[sev] ?? 0;
                const total = summary
                  ? Object.values(summary.bySeverity).reduce((s, c) => s + c, 0)
                  : 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={sev} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-[10px] font-bold rounded px-1.5 py-0.5',
                          SEVERITY_COLORS[sev],
                        )}
                      >
                        {SEVERITY_LABEL[sev]}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        {count}{' '}
                        <span className="text-slate-400 dark:text-zinc-500 font-normal">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-current rounded-full transition-all duration-500 opacity-60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Tactic breakdown */}
        <SectionCard title="Top Covered Tactics (by detection count)">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : tacticEntries.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-6">
              No tactic data yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tacticEntries.map(([tactic, count]) => (
                <BarRow
                  key={tactic}
                  label={tactic}
                  value={count}
                  max={maxTactic}
                  colorClass="bg-gradient-to-r from-purple-500 to-purple-400"
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent high-risk rules */}
        <SectionCard title="Recent High / Critical Detections">
          {loading ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-2">
              {(summary?.recentDetections ?? [])
                .filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH')
                .slice(0, 7)
                .map((det) => (
                  <div key={det.id} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'text-[9px] font-bold rounded px-1.5 py-0.5 shrink-0',
                        SEVERITY_COLORS[det.severity as DetectionSeverity],
                      )}
                    >
                      {det.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-700 dark:text-zinc-300 truncate">
                        {det.name}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {det.mitreAttackId ?? det.ruleId}
                      </p>
                    </div>
                    {det.expectedFpRate != null && (
                      <span
                        className={cn(
                          'text-[10px] font-semibold shrink-0',
                          det.expectedFpRate > 15
                            ? 'text-red-500'
                            : det.expectedFpRate > 8
                              ? 'text-amber-500'
                              : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {det.expectedFpRate.toFixed(1)}% FP
                      </span>
                    )}
                  </div>
                ))}
              {!(summary?.recentDetections ?? []).some(
                (d) => d.severity === 'CRITICAL' || d.severity === 'HIGH',
              ) && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">
                  No high/critical detections yet.
                </p>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Custom Dashboard ──────────────────────────────────────────────────────────

function CustomDashboard({
  loading,
  summary,
  connectedIntegrations,
  huntStats,
  coverage,
}: {
  loading: boolean;
  summary: DashboardSummary | null;
  connectedIntegrations: IntegrationRow[];
  huntStats: THaaSStats | null;
  coverage: { total: number; covered: number; pct: number } | null;
}) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Query widget form
  const [queryLabel, setQueryLabel] = useState('');
  const [queryText, setQueryText] = useState('');
  const [queryLang, setQueryLang] = useState<'KQL' | 'SPL' | 'Custom'>('KQL');
  const [queryValidation, setQueryValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [showQueryForm, setShowQueryForm] = useState(false);

  function addPresetWidget(type: PresetWidgetType) {
    const already = widgets.some((w) => w.type === 'preset' && w.preset === type);
    if (already) return;
    setWidgets((prev) => [...prev, { id: uid(), type: 'preset', preset: type }]);
    setShowPicker(false);
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  async function handleValidate() {
    setValidating(true);
    setQueryValidation(null);
    await new Promise((r) => setTimeout(r, 400));
    const result = validateQuery(queryText);
    setQueryValidation(result);
    setValidating(false);
  }

  function addQueryWidget() {
    if (!queryValidation?.valid) return;
    setWidgets((prev) => [
      ...prev,
      {
        id: uid(),
        type: 'query',
        label: queryLabel || 'Custom Query',
        query: queryText,
        queryLang,
        validation: queryValidation,
      },
    ]);
    setQueryLabel('');
    setQueryText('');
    setQueryValidation(null);
    setShowQueryForm(false);
    setShowPicker(false);
  }

  function getPresetValue(type: PresetWidgetType): string {
    if (loading) return '…';
    switch (type) {
      case 'detection-count':
        return String(summary?.enabledDetections ?? '—');
      case 'mitre-coverage':
        return coverage ? `${coverage.pct}%` : '—';
      case 'active-integrations':
        return String(connectedIntegrations.length);
      case 'active-hunts':
        return String(huntStats?.active ?? '—');
      case 'high-severity-count':
        return String(
          Object.entries(summary?.bySeverity ?? {})
            .filter(([s]) => s === 'CRITICAL' || s === 'HIGH')
            .reduce((a, [, c]) => a + c, 0),
        );
      case 'avg-fp-rate':
        return summary?.avgFpRate != null ? `${summary.avgFpRate.toFixed(1)}%` : 'N/A';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Custom Dashboard</h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            Add pre-defined metric widgets or custom validated queries
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowPicker((v) => !v);
            setShowQueryForm(false);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Widget
        </button>
      </div>

      {/* Widget picker */}
      {showPicker && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Widget Catalogue
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setShowQueryForm(false);
              }}
              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Preset widgets */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
              Metric Widgets (read-only)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_CATALOGUE.map(({ type, label, icon: Icon, color }) => {
                const added = widgets.some((w) => w.type === 'preset' && w.preset === type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={added}
                    onClick={() => addPresetWidget(type)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left',
                      added
                        ? 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                        : 'border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        added ? 'text-slate-300 dark:text-zinc-600' : color,
                      )}
                    />
                    {label}
                    {added && (
                      <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Query widget builder */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
              Query Widget
            </p>
            {!showQueryForm ? (
              <button
                type="button"
                onClick={() => setShowQueryForm(true)}
                className="flex items-center gap-2 rounded-lg border border-dashed border-black/20 dark:border-white/20 px-3 py-2 text-xs text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors w-full"
              >
                <Plus className="h-3.5 w-3.5" /> Add custom query widget
              </button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg border border-blue-500/20 bg-blue-50/30 dark:bg-blue-500/5">
                <div className="flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <p className="text-[10px] text-blue-700 dark:text-blue-400">
                    Queries are validated for safety before being added. Only read operations are
                    permitted.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                    Widget Label
                  </label>
                  <input
                    value={queryLabel}
                    onChange={(e) => setQueryLabel(e.target.value)}
                    placeholder="e.g. Failed Logins Last 24h"
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                      Query Language
                    </label>
                    <select
                      value={queryLang}
                      onChange={(e) => setQueryLang(e.target.value as typeof queryLang)}
                      className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="KQL">KQL (Kusto Query Language)</option>
                      <option value="SPL">SPL (Splunk)</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">
                    Query
                  </label>
                  <textarea
                    value={queryText}
                    onChange={(e) => {
                      setQueryText(e.target.value);
                      setQueryValidation(null);
                    }}
                    placeholder={
                      queryLang === 'KQL'
                        ? 'DeviceNetworkEvents\n| where Timestamp > ago(24h)\n| summarize count() by DeviceName'
                        : queryLang === 'SPL'
                          ? 'index=* sourcetype=auth action=failure\n| stats count by user\n| sort -count'
                          : 'Enter your query...'
                    }
                    rows={5}
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-slate-900 px-3 py-2 text-xs text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono resize-none"
                  />
                </div>

                {/* Validation result */}
                {queryValidation && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-lg p-2.5 text-xs',
                      queryValidation.valid
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400',
                    )}
                  >
                    {queryValidation.valid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>
                      {queryValidation.valid
                        ? 'Query passed validation. Safe to add.'
                        : queryValidation.error}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleValidate()}
                    disabled={!queryText.trim() || validating}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    {validating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    Validate Query
                  </button>
                  <button
                    type="button"
                    onClick={addQueryWidget}
                    disabled={!queryValidation?.valid}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3" /> Add Widget
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQueryForm(false);
                      setQueryValidation(null);
                      setQueryText('');
                      setQueryLabel('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Widget grid */}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-black/20 dark:border-white/10">
          <Sliders className="h-10 w-10 text-slate-200 dark:text-zinc-700" />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
              Your dashboard is empty
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Click "Add Widget" to start building your custom view
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              onRemove={() => removeWidget(widget.id)}
              presetValue={widget.type === 'preset' ? getPresetValue(widget.preset) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  widget,
  onRemove,
  presetValue,
}: {
  widget: DashboardWidget;
  onRemove: () => void;
  presetValue?: string;
}) {
  if (widget.type === 'preset') {
    const meta = PRESET_CATALOGUE.find((c) => c.type === widget.preset)!;
    const Icon = meta.icon;
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm relative group">
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-all"
        >
          <X className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
        </button>
        <div className="flex items-center gap-1.5 mb-2">
          <GripVertical className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-600" />
          <Icon className={cn('h-4 w-4', meta.color)} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            {meta.label}
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{presetValue}</p>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
          Live · Read-only metric
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-5 shadow-sm relative group sm:col-span-2 xl:col-span-2">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-all"
      >
        <X className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
      </button>
      <div className="flex items-center gap-1.5 mb-3">
        <GripVertical className="h-3.5 w-3.5 text-slate-300 dark:text-zinc-600" />
        <Database className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
          {widget.label}
        </span>
        <span className="ml-auto text-[9px] font-bold text-slate-400 dark:text-zinc-500 border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5">
          {widget.queryLang}
        </span>
      </div>
      <pre className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-slate-900/5 dark:bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all border border-black/5 dark:border-white/5">
        {widget.query}
      </pre>
      <div className="flex items-center gap-1.5 mt-2">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          Query validated
        </span>
      </div>
    </div>
  );
}
