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
  Lightbulb,
  Database,
  Trash2,
  Zap,
  Plug,
  Loader2,
  ChevronUp,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectionsApi,
  type DetectionRow,
  type TenantLogSource,
  type DetectionProposal,
  type CreateDetectionPayload,
  type DetectionSeverity,
  type DetectionPlatform,
  type DetectionRuleType,
  type DetectionLifecycle,
  type DetectionWorkflowStatus,
  type QueryLanguage,
  SEVERITY_LABEL,
  SEVERITY_COLORS,
  PLATFORM_LABEL,
  PLATFORM_COLORS,
  QUERY_LANG_LABEL,
  RULE_TYPE_LABEL,
  LIFECYCLE_LABEL,
  LIFECYCLE_COLORS,
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_COLORS,
} from '@/lib/detections.api';
import {
  integrationsApi,
  PLATFORM_INFO,
  STATUS_BADGE,
  type IntegrationRow,
  type SiemDeployment,
  type SplunkJobRun,
} from '@/lib/integrations.api';

// ── Log source catalog ────────────────────────────────────────────────────────

const LOG_SOURCE_CATALOG = [
  {
    logSource: 'Windows Security',
    label: 'Windows Security',
    desc: 'Windows Event Logs, AD security events',
  },
  {
    logSource: 'Network Communication',
    label: 'Firewall / Network',
    desc: 'Firewall policies, perimeter traffic, NAT',
  },
  { logSource: 'Authentication', label: 'Authentication', desc: 'Login events, MFA, LDAP, SSO' },
  { logSource: 'DNS', label: 'DNS', desc: 'Query/response logs, recursive resolvers' },
  {
    logSource: 'Email',
    label: 'Email Gateway',
    desc: 'Email delivery, anti-spam, phishing detection',
  },
  {
    logSource: 'Endpoint Detection and Response',
    label: 'EDR / Endpoint',
    desc: 'Process, file, registry, network events',
  },
  {
    logSource: 'Anti-Virus / Anti-Malware',
    label: 'Antivirus / AV',
    desc: 'Malware detections, quarantine events',
  },
  {
    logSource: 'Web Proxy / NGFW',
    label: 'Web Proxy / NGFW',
    desc: 'HTTP/S proxy, URL filtering, SSL inspection',
  },
  { logSource: 'IDS / IPS', label: 'IDS / IPS', desc: 'Intrusion detection and prevention alerts' },
  {
    logSource: 'Active Directory',
    label: 'Active Directory',
    desc: 'Directory service events, Group Policy',
  },
  { logSource: 'DLP', label: 'DLP', desc: 'Data loss prevention, file transfer events' },
  { logSource: 'AWS', label: 'AWS / Cloud', desc: 'CloudTrail, Config, GuardDuty logs' },
  { logSource: 'Linux Syslog', label: 'Linux / Syslog', desc: 'Syslog, auth.log, auditd events' },
  {
    logSource: 'Database Audit',
    label: 'Database Audit',
    desc: 'SQL queries, database access control',
  },
  { logSource: 'Web Server Logs', label: 'Web Server', desc: 'Apache/Nginx access and error logs' },
  {
    logSource: 'Application Audit',
    label: 'Application Audit',
    desc: 'ERP, SAP, CITRIX application logs',
  },
];

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

const ALL_RULE_TYPE_OPTIONS: DetectionRuleType[] = [
  'ANOMALY',
  'INVESTIGATE',
  'HIGH_FIDELITY',
  'CORRELATION',
  'THREAT_INTEL',
];
const ALL_LIFECYCLE_OPTIONS: DetectionLifecycle[] = [
  'EXPERIMENTAL',
  'FUNCTIONAL',
  'STABLE',
  'RETIRED',
];
const ALL_WORKFLOW_STATUS_OPTIONS: DetectionWorkflowStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'REVIEW',
  'APPROVED',
  'ENABLED',
  'DISABLED',
];

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
  ruleType: 'ANOMALY',
  lifecycleStage: 'EXPERIMENTAL',
  workflowStatus: 'PENDING',
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

  // View mode: library or proposals
  const [viewMode, setViewMode] = useState<'library' | 'proposals'>('library');

  // Log sources
  const [logSources, setLogSources] = useState<TenantLogSource[]>([]);
  const [showLogSources, setShowLogSources] = useState(false);
  const [addingSource, setAddingSource] = useState<string | null>(null);

  // Proposals
  const [proposals, setProposals] = useState<DetectionProposal[]>([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [enablingProposal, setEnablingProposal] = useState<Record<string, boolean>>({});

  // Deploy to SIEM
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [deployIntegrations, setDeployIntegrations] = useState<IntegrationRow[]>([]);
  const [deployments, setDeployments] = useState<SiemDeployment[]>([]);
  const [loadingDeployPanel, setLoadingDeployPanel] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  // Bulk toggle
  const [bulkToggling, setBulkToggling] = useState(false);

  // Splunk history
  const [splunkHistory, setSplunkHistory] = useState<
    Record<string, { runs: SplunkJobRun[]; totalRuns: number; triggeredRuns: number } | null>
  >({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Edit / duplicate
  const [editingDetection, setEditingDetection] = useState<DetectionRow | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchLogSources = useCallback(async () => {
    try {
      const data = await detectionsApi.listLogSources();
      setLogSources(data);
    } catch {
      // non-critical — silently fail
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    setProposalLoading(true);
    try {
      const res = await detectionsApi.proposals();
      setProposals(res.proposals);
    } catch {
      setProposals([]);
    } finally {
      setProposalLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogSources();
  }, [fetchLogSources]);

  useEffect(() => {
    if (viewMode === 'proposals') void fetchProposals();
  }, [viewMode, fetchProposals]);

  const handleAddLogSource = async (logSource: string) => {
    if (logSources.some((ls) => ls.logSource === logSource)) return;
    setAddingSource(logSource);
    try {
      const added = await detectionsApi.addLogSource({ logSource });
      setLogSources((prev) => [...prev, added]);
    } catch {
      // ignore duplicate
    } finally {
      setAddingSource(null);
    }
  };

  const handleRemoveLogSource = async (id: string) => {
    try {
      await detectionsApi.removeLogSource(id);
      setLogSources((prev) => prev.filter((ls) => ls.id !== id));
    } catch {
      // ignore
    }
  };

  const handleEnableProposal = async (proposal: DetectionProposal) => {
    if (enablingProposal[proposal.id]) return;
    setEnablingProposal((prev) => ({ ...prev, [proposal.id]: true }));
    try {
      await detectionsApi.toggle(proposal.id, true);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
    } catch {
      // silently fail
    } finally {
      setEnablingProposal((prev) => ({ ...prev, [proposal.id]: false }));
    }
  };

  const openDeployPanel = useCallback(async (detectionId: string) => {
    setShowDeployPanel(true);
    setLoadingDeployPanel(true);
    try {
      const [ints, deps] = await Promise.all([
        integrationsApi.list(),
        integrationsApi.listDeployments(detectionId),
      ]);
      setDeployIntegrations(ints.filter((i) => i.isEnabled));
      setDeployments(deps);
    } catch {
      // non-critical
    } finally {
      setLoadingDeployPanel(false);
    }
  }, []);

  const handleDeploy = async (integrationId: string, detectionId: string) => {
    setDeployingId(integrationId);
    try {
      const dep = await integrationsApi.deploy(integrationId, detectionId);
      setDeployments((prev) => {
        const exists = prev.find((d) => d.integrationId === integrationId);
        return exists
          ? prev.map((d) => (d.integrationId === integrationId ? dep : d))
          : [...prev, dep];
      });
    } finally {
      setDeployingId(null);
    }
  };

  const handleUndeploy = async (integrationId: string, detectionId: string) => {
    setDeployingId(integrationId);
    try {
      const dep = await integrationsApi.undeploy(integrationId, detectionId);
      setDeployments((prev) => prev.map((d) => (d.integrationId === integrationId ? dep : d)));
    } finally {
      setDeployingId(null);
    }
  };

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

  const handleBulkToggle = async (enable: boolean) => {
    if (bulkToggling || detections.length === 0) return;
    setBulkToggling(true);
    try {
      await detectionsApi.bulkToggle(
        detections.map((d) => d.id),
        enable,
      );
      setDetections((prev) => prev.map((d) => ({ ...d, isEnabled: enable })));
    } catch {
      void fetchDetections();
    } finally {
      setBulkToggling(false);
    }
  };

  const fetchSplunkJobHistory = async (integrationId: string, detectionId: string) => {
    const key = `${integrationId}-${detectionId}`;
    if (loadingHistory === key) return;
    setLoadingHistory(key);
    try {
      const result = await integrationsApi.fetchSplunkHistory(integrationId, detectionId);
      setSplunkHistory((prev) => ({ ...prev, [key]: result }));
      // Refresh detection list so Triggers/FP% columns pick up newly synced stats
      void fetchDetections();
    } catch {
      setSplunkHistory((prev) => ({ ...prev, [key]: null }));
    } finally {
      setLoadingHistory(null);
    }
  };

  const handleEdit = (det: DetectionRow) => {
    setEditingDetection(det);
    setForm({
      name: det.name,
      description: det.description,
      severity: det.severity,
      platform: det.platform,
      query: det.query,
      queryLanguage: det.queryLanguage,
      mitreAttackId: det.mitreAttackId ?? '',
      mitreTactic: det.mitreTactic ?? '',
      mitreTechnique: det.mitreTechnique ?? '',
      nistControls: det.nistControls,
      dataSources: det.dataSources,
      tags: det.tags,
      ruleType: det.ruleType ?? 'ANOMALY',
      lifecycleStage: det.lifecycleStage,
      workflowStatus: det.workflowStatus,
    });
    setNistInput(det.nistControls.join(', '));
    setDsInput(det.dataSources.join(', '));
    setTagsInput(det.tags.join(', '));
    setCreateError(null);
    setShowNewModal(true);
  };

  const handleDuplicate = async (det: DetectionRow) => {
    if (duplicating === det.id) return;
    setDuplicating(det.id);
    try {
      const copy = await detectionsApi.duplicate(det.id);
      setDetections((prev) => [copy, ...prev]);
      setSelected(copy);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate detection';
      setCreateError(msg);
    } finally {
      setDuplicating(null);
    }
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

      if (editingDetection) {
        const updated = await detectionsApi.update(editingDetection.id, payload);
        setDetections((prev) => prev.map((d) => (d.id === editingDetection.id ? updated : d)));
        if (selected?.id === editingDetection.id) setSelected(updated);
        setEditingDetection(null);
      } else {
        const created = await detectionsApi.create(payload);
        setDetections((prev) => [created, ...prev]);
        setSelected(created);
      }

      setShowNewModal(false);
      setForm(BLANK_FORM);
      setNistInput('');
      setDsInput('');
      setTagsInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save detection';
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
            {/* View tabs */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode('library');
                  setSelected(null);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  viewMode === 'library'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <Shield className="h-3.5 w-3.5" /> Detection Library
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('proposals');
                  setSelected(null);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  viewMode === 'proposals'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <Lightbulb className="h-3.5 w-3.5" /> Proposed
                {proposals.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold">
                    {proposals.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowLogSources(true)}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <Database className="h-3.5 w-3.5" />
                Log Sources
                {logSources.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold">
                    {logSources.length}
                  </span>
                )}
              </button>
            </div>

            {viewMode === 'library' && (
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
            )}

            {viewMode === 'library' && (
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
                {detections.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => void handleBulkToggle(true)}
                      disabled={bulkToggling}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <ToggleRight className="h-3 w-3" />
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkToggle(false)}
                      disabled={bulkToggling}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-zinc-400 border border-slate-500/20 hover:bg-slate-500/20 transition-colors disabled:opacity-50"
                    >
                      <ToggleLeft className="h-3 w-3" />
                      Disable All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Proposals view ──────────────────────────────────────────── */}
          {viewMode === 'proposals' && (
            <div className="flex-1 overflow-y-auto">
              {logSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
                  <Database className="h-10 w-10 text-slate-200 dark:text-zinc-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      No log sources registered
                    </p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      Register your log sources to get smart detection proposals based on what data
                      you send to your SIEM.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLogSources(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                  >
                    <Database className="h-3.5 w-3.5" /> Register Log Sources
                  </button>
                </div>
              ) : proposalLoading ? (
                <div className="flex flex-col gap-1 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : proposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    All detections are enabled
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">
                    No new proposals for your {logSources.length} registered log source
                    {logSources.length !== 1 ? 's' : ''}.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      {proposals.length} detection{proposals.length !== 1 ? 's' : ''} proposed based
                      on your {logSources.length} log source{logSources.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {proposals.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold',
                              SEVERITY_COLORS[p.severity],
                            )}
                          >
                            {SEVERITY_LABEL[p.severity]}
                          </span>
                          <span
                            className={cn(
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              PLATFORM_COLORS[p.platform],
                            )}
                          >
                            {PLATFORM_LABEL[p.platform]}
                          </span>
                          {p.mitreAttackId && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                              {p.mitreAttackId}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.matchedSources.map((s) => (
                            <span
                              key={s}
                              className="rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 px-1.5 py-0.5 text-[10px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleEnableProposal(p)}
                        disabled={enablingProposal[p.id]}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        <Zap className="h-3 w-3" />
                        {enablingProposal[p.id] ? '...' : 'Enable'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Library list content ─────────────────────────────────────── */}
          {viewMode === 'library' && (
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
                      {[
                        '',
                        'On',
                        'Detection',
                        'Rule Type',
                        'Lifecycle',
                        'Status',
                        'Owner',
                        'Platform',
                        'Severity',
                        'FP%',
                        'Alerts/d',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-zinc-500 whitespace-nowrap"
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
                        onClick={() => {
                          setSelected(det.id === selected?.id ? null : det);
                          setShowDeployPanel(false);
                        }}
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

                        <td className="px-3 py-3 max-w-[160px]">
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

                        {/* Rule Type */}
                        <td className="px-3 py-3">
                          {det.ruleType ? (
                            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 whitespace-nowrap">
                              {RULE_TYPE_LABEL[det.ruleType]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Lifecycle */}
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                              LIFECYCLE_COLORS[det.lifecycleStage],
                            )}
                          >
                            {LIFECYCLE_LABEL[det.lifecycleStage]}
                          </span>
                        </td>

                        {/* Workflow Status */}
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                              WORKFLOW_STATUS_COLORS[det.workflowStatus],
                            )}
                          >
                            {WORKFLOW_STATUS_LABEL[det.workflowStatus]}
                          </span>
                        </td>

                        {/* Owner */}
                        <td className="px-3 py-3 text-[10px] text-slate-500 dark:text-zinc-400 max-w-[80px]">
                          <span className="truncate block">
                            {det.ownerName ?? (det.isGlobal ? 'OneMDR' : '—')}
                          </span>
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
          )}
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
                  {selected.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleEdit(selected)}
                      title="Edit this custom detection"
                      className="flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(selected)}
                    disabled={duplicating === selected.id}
                    title="Duplicate as a new custom detection"
                    className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {duplicating === selected.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {duplicating === selected.id ? '...' : 'Duplicate'}
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

              {/* Log Sources */}
              {selected.logSources && selected.logSources.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                    Log Sources
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selected.logSources.map((ls) => (
                      <span
                        key={ls}
                        className="rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-400 font-medium"
                      >
                        {ls}
                      </span>
                    ))}
                  </div>
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

              {/* Deploy to SIEM */}
              <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (!showDeployPanel) void openDeployPanel(selected.id);
                    else setShowDeployPanel(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 bg-black/3 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-200">
                    <Plug className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                    Deploy to SIEM
                  </span>
                  {showDeployPanel ? (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  )}
                </button>

                {showDeployPanel && (
                  <div className="px-3 pb-3 pt-2 space-y-2 border-t border-black/5 dark:border-white/5">
                    {loadingDeployPanel ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-zinc-500" />
                      </div>
                    ) : deployIntegrations.length === 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 py-2 text-center">
                        No active integrations. Configure one in{' '}
                        <a href="/integrations" className="text-blue-500 hover:underline">
                          Integrations
                        </a>
                        .
                      </p>
                    ) : (
                      deployIntegrations.map((integration) => {
                        const dep = deployments.find(
                          (d) => d.integrationId === integration.id && d.status !== 'removed',
                        );
                        const isDeploying = deployingId === integration.id;
                        const info = PLATFORM_INFO[integration.platform];
                        const badge = STATUS_BADGE[integration.status];
                        return (
                          <div
                            key={integration.id}
                            className="flex items-center gap-2 rounded-lg border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/3 px-3 py-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-[10px] font-semibold truncate', info.color)}>
                                {integration.name}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className={cn(
                                    'text-[9px] rounded px-1.5 py-0.5 border font-medium',
                                    badge.className,
                                  )}
                                >
                                  {badge.label}
                                </span>
                                {dep && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    ✓ Deployed{dep.remoteId ? ` (${dep.remoteId})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            {dep ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {integration.platform === 'SPLUNK' && (
                                  <button
                                    type="button"
                                    disabled={loadingHistory === `${integration.id}-${selected.id}`}
                                    onClick={() =>
                                      void fetchSplunkJobHistory(integration.id, selected.id)
                                    }
                                    className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                    title="Fetch alert trigger history from Splunk"
                                  >
                                    {loadingHistory === `${integration.id}-${selected.id}` ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'History'
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isDeploying}
                                  onClick={() => void handleUndeploy(integration.id, selected.id)}
                                  className="rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                >
                                  {isDeploying ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    'Remove'
                                  )}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isDeploying || integration.status !== 'CONNECTED'}
                                onClick={() => void handleDeploy(integration.id, selected.id)}
                                className="shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                              >
                                {isDeploying ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : integration.status !== 'CONNECTED' ? (
                                  'Not connected'
                                ) : (
                                  'Deploy'
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                    {/* Splunk job history panel */}
                    {Object.entries(splunkHistory).map(([key, hist]) => {
                      if (!hist || !key.includes(selected.id)) return null;
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                              Splunk Job History
                            </p>
                            <div className="flex items-center gap-3 text-[10px] font-semibold">
                              <span className="text-slate-600 dark:text-zinc-300">
                                {hist.totalRuns} runs
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {hist.triggeredRuns} triggered
                              </span>
                            </div>
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {hist.runs.slice(0, 20).map((run) => (
                              <div key={run.sid} className="flex items-center gap-2 text-[10px]">
                                <span
                                  className={cn(
                                    'shrink-0 h-1.5 w-1.5 rounded-full',
                                    run.resultCount > 0
                                      ? 'bg-emerald-500'
                                      : 'bg-slate-300 dark:bg-zinc-600',
                                  )}
                                />
                                <span className="text-slate-500 dark:text-zinc-400 font-mono">
                                  {run.published ? new Date(run.published).toLocaleString() : 'N/A'}
                                </span>
                                <span
                                  className={cn(
                                    'ml-auto font-semibold',
                                    run.resultCount > 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400 dark:text-zinc-500',
                                  )}
                                >
                                  {run.resultCount > 0
                                    ? `${run.resultCount} results`
                                    : `${run.eventCount} events`}
                                </span>
                              </div>
                            ))}
                            {hist.runs.length === 0 && (
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center py-2">
                                No job history found
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-4 text-[10px] text-slate-400 dark:text-zinc-500 border-t border-black/10 dark:border-white/10 pt-3">
                <span>Created {new Date(selected.createdAt).toLocaleDateString()}</span>
                <span>Updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Log Sources Modal ─────────────────────────────────────────────── */}
      {showLogSources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 flex flex-col">
            <div className="border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Source Registry
                </h2>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  Register which log sources you send to your SIEM to get smart detection proposals
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogSources(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Currently registered */}
              {logSources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                    Registered ({logSources.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {logSources.map((ls) => (
                      <div
                        key={ls.id}
                        className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 pl-3 pr-1.5 py-1"
                      >
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {ls.logSource}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveLogSource(ls.id)}
                          className="rounded-full p-0.5 text-emerald-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog grid */}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-3">
                  Available Log Sources — click to add
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LOG_SOURCE_CATALOG.map((cat) => {
                    const isAdded = logSources.some((ls) => ls.logSource === cat.logSource);
                    const isAdding = addingSource === cat.logSource;
                    return (
                      <button
                        key={cat.logSource}
                        type="button"
                        onClick={() => void handleAddLogSource(cat.logSource)}
                        disabled={isAdded || isAdding}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                          isAdded
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 cursor-default'
                            : 'border-black/10 dark:border-white/10 hover:border-amber-400/50 dark:hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 cursor-pointer',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={cn(
                                'text-xs font-semibold',
                                isAdded
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-800 dark:text-zinc-200',
                              )}
                            >
                              {cat.label}
                            </p>
                            {isAdded && (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            )}
                            {isAdding && (
                              <RefreshCw className="h-3 w-3 text-amber-500 animate-spin shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-tight">
                            {cat.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                {logSources.length} source{logSources.length !== 1 ? 's' : ''} registered
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowLogSources(false);
                  if (logSources.length > 0) {
                    setViewMode('proposals');
                    void fetchProposals();
                  }
                }}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
              >
                {logSources.length > 0 ? 'View Proposals' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Detection Modal ───────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingDetection ? 'Edit Detection' : 'New Custom Detection'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowNewModal(false);
                  setEditingDetection(null);
                  setCreateError(null);
                  setForm(BLANK_FORM);
                  setNistInput('');
                  setDsInput('');
                  setTagsInput('');
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

              {/* Rule Type + Lifecycle + Workflow Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Rule Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.ruleType ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ruleType: e.target.value as DetectionRuleType }))
                    }
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  >
                    {ALL_RULE_TYPE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {RULE_TYPE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Lifecycle <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.lifecycleStage ?? 'EXPERIMENTAL'}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lifecycleStage: e.target.value as DetectionLifecycle,
                      }))
                    }
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  >
                    {ALL_LIFECYCLE_OPTIONS.map((l) => (
                      <option key={l} value={l}>
                        {LIFECYCLE_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Workflow Status <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.workflowStatus ?? 'PENDING'}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        workflowStatus: e.target.value as DetectionWorkflowStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 outline-none focus:border-amber-500/50"
                  >
                    {ALL_WORKFLOW_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {WORKFLOW_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* MITRE */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    MITRE ID <span className="text-red-400">*</span>
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
                    Tactic <span className="text-red-400">*</span>
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
                  setEditingDetection(null);
                  setCreateError(null);
                  setForm(BLANK_FORM);
                  setNistInput('');
                  setDsInput('');
                  setTagsInput('');
                }}
                className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={
                  creating ||
                  !form.name ||
                  !form.description ||
                  !form.query ||
                  !form.mitreAttackId ||
                  !form.mitreTactic ||
                  !form.ruleType ||
                  !form.lifecycleStage ||
                  !form.workflowStatus
                }
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating
                  ? editingDetection
                    ? 'Saving...'
                    : 'Creating...'
                  : editingDetection
                    ? 'Save Changes'
                    : 'Create Detection'}
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
