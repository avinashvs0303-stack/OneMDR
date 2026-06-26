'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Server,
  Database,
  Globe,
  Shield,
  Cpu,
  Network,
  HardDrive,
  Cloud,
  Building2,
  Zap,
  LayoutGrid,
  ShieldAlert,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  getModel,
  updateModelStatus,
  addComponent,
  deleteComponent,
  addFlow,
  deleteFlow,
  generateThreats,
  updateThreat,
  deleteThreat,
  type ThreatModelDetail,
  type TmThreat,
  type ModelStatus,
  type StrideCategory,
  type ThreatStatus,
  type DataClassification,
} from '@/lib/threat-models.api';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPONENT_TYPES = [
  { value: 'SERVER', label: 'Server', icon: <Server className="w-3.5 h-3.5" /> },
  { value: 'DATABASE', label: 'Database', icon: <Database className="w-3.5 h-3.5" /> },
  { value: 'API_GATEWAY', label: 'API Gateway', icon: <Globe className="w-3.5 h-3.5" /> },
  { value: 'WEBAPP', label: 'Web App', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { value: 'LOAD_BALANCER', label: 'Load Balancer', icon: <Network className="w-3.5 h-3.5" /> },
  { value: 'FIREWALL', label: 'Firewall', icon: <Shield className="w-3.5 h-3.5" /> },
  { value: 'VPN', label: 'VPN', icon: <Shield className="w-3.5 h-3.5" /> },
  { value: 'S3_BUCKET', label: 'S3 Bucket', icon: <HardDrive className="w-3.5 h-3.5" /> },
  { value: 'IAM_ROLE', label: 'IAM Role', icon: <Shield className="w-3.5 h-3.5" /> },
  { value: 'CONTAINER', label: 'Container', icon: <Cpu className="w-3.5 h-3.5" /> },
  {
    value: 'ACTIVE_DIRECTORY',
    label: 'Active Directory',
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  { value: 'WORKSTATION', label: 'Workstation', icon: <Cpu className="w-3.5 h-3.5" /> },
  { value: 'SWITCH', label: 'Switch', icon: <Network className="w-3.5 h-3.5" /> },
  { value: 'MESSAGE_QUEUE', label: 'Message Queue', icon: <Zap className="w-3.5 h-3.5" /> },
  { value: 'CACHE', label: 'Cache', icon: <HardDrive className="w-3.5 h-3.5" /> },
  { value: 'CDN', label: 'CDN', icon: <Cloud className="w-3.5 h-3.5" /> },
  {
    value: 'IDENTITY_PROVIDER',
    label: 'Identity Provider',
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  { value: 'MONITORING', label: 'Monitoring', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { value: 'DNS', label: 'DNS', icon: <Globe className="w-3.5 h-3.5" /> },
];

const STRIDE_META: Record<StrideCategory, { label: string; color: string; abbr: string }> = {
  SPOOFING: {
    label: 'Spoofing',
    color: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
    abbr: 'S',
  },
  TAMPERING: {
    label: 'Tampering',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    abbr: 'T',
  },
  REPUDIATION: {
    label: 'Repudiation',
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    abbr: 'R',
  },
  INFO_DISCLOSURE: {
    label: 'Info Disclosure',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    abbr: 'I',
  },
  DENIAL_OF_SERVICE: {
    label: 'Denial of Service',
    color: 'text-red-400    bg-red-400/10    border-red-400/20',
    abbr: 'D',
  },
  ELEVATION_OF_PRIVILEGE: {
    label: 'Elevation of Privilege',
    color: 'text-pink-400   bg-pink-400/10   border-pink-400/20',
    abbr: 'E',
  },
};

const STATUS_META: Record<ThreatStatus, { label: string; icon: React.ReactNode; color: string }> = {
  OPEN: {
    label: 'Open',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'text-red-400    bg-red-400/10    border-red-400/20',
  },
  MITIGATED: {
    label: 'Mitigated',
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'text-green-400  bg-green-400/10  border-green-400/20',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: <Eye className="w-3 h-3" />,
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  },
  FALSE_POSITIVE: {
    label: 'False Positive',
    icon: <XCircle className="w-3 h-3" />,
    color: 'text-zinc-400   bg-zinc-400/10   border-zinc-400/20',
  },
};

function riskBadge(score: number) {
  if (score >= 15)
    return { label: 'CRITICAL', color: 'text-red-400    bg-red-400/10    border-red-400/20' };
  if (score >= 10)
    return { label: 'HIGH', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' };
  if (score >= 5)
    return { label: 'MEDIUM', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
  return { label: 'LOW', color: 'text-green-400  bg-green-400/10  border-green-400/20' };
}

function riskCell(score: number) {
  if (score >= 15) return 'bg-red-500/30 border-red-500/40 hover:bg-red-500/40';
  if (score >= 10) return 'bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30';
  if (score >= 5) return 'bg-yellow-500/15 border-yellow-500/25 hover:bg-yellow-500/25';
  return 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20';
}

// ── Component type label helper ───────────────────────────────────────────────

function ctLabel(type: string) {
  return COMPONENT_TYPES.find((c) => c.value === type)?.label ?? type;
}

// ── Risk Matrix ───────────────────────────────────────────────────────────────

function RiskMatrix({ threats }: { threats: TmThreat[] }) {
  const cells: Record<string, TmThreat[]> = {};
  for (let l = 1; l <= 5; l++) {
    for (let i = 1; i <= 5; i++) {
      cells[`${l}:${i}`] = [];
    }
  }
  for (const t of threats) {
    const key = `${t.likelihood}:${t.impact}`;
    cells[key] = [...(cells[key] ?? []), t];
  }

  return (
    <div>
      <div className="mb-4 text-sm text-zinc-400">
        5×5 likelihood × impact matrix — hover a cell to see threats
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-20 text-right pr-2 text-xs text-zinc-600 font-normal pb-1">
                Likelihood ↑
              </th>
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="w-32 text-center text-xs text-zinc-500 font-normal pb-1">
                  Impact {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((l) => (
              <tr key={l}>
                <td className="text-right pr-2 text-xs text-zinc-500 w-20">L={l}</td>
                {[1, 2, 3, 4, 5].map((i) => {
                  const score = l * i;
                  const list = cells[`${l}:${i}`] ?? [];
                  return (
                    <td key={i} className="p-1">
                      <div
                        className={`relative h-16 w-32 rounded border ${riskCell(score)} transition-colors cursor-default group`}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
                          <span className="text-xs font-bold text-white/40">{score}</span>
                          {list.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {list.slice(0, 4).map((t) => (
                                <div
                                  key={t.id}
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${STRIDE_META[t.strideCategory].color}`}
                                  title={t.title}
                                >
                                  {STRIDE_META[t.strideCategory].abbr}
                                </div>
                              ))}
                              {list.length > 4 && (
                                <span className="text-[9px] text-zinc-500">+{list.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Tooltip on hover */}
                        {list.length > 0 && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            {list.map((t) => (
                              <div key={t.id} className="py-0.5 truncate">
                                {t.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-4 text-xs text-zinc-500">
        {[
          { label: 'Critical (≥15)', color: 'bg-red-500/30 border-red-500/40' },
          { label: 'High (10–14)', color: 'bg-orange-500/20 border-orange-500/30' },
          { label: 'Medium (5–9)', color: 'bg-yellow-500/15 border-yellow-500/25' },
          { label: 'Low (1–4)', color: 'bg-green-500/10 border-green-500/20' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'components' | 'flows' | 'threats' | 'matrix';

export default function ThreatModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [model, setModel] = useState<ThreatModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('components');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  // Component form
  const [showCompForm, setShowCompForm] = useState(false);
  const [compForm, setCompForm] = useState({
    name: '',
    componentType: 'SERVER',
    environment: 'CLOUD' as 'CLOUD' | 'ONPREM',
    cloudProvider: '',
    serviceName: '',
    notes: '',
  });
  const [savingComp, setSavingComp] = useState(false);

  // Flow form
  const [showFlowForm, setShowFlowForm] = useState(false);
  const [flowForm, setFlowForm] = useState({
    name: '',
    sourceId: '',
    targetId: '',
    protocol: 'HTTPS',
    dataClassification: 'INTERNAL' as DataClassification,
    isEncrypted: true,
    crossesTrustBoundary: false,
    notes: '',
  });
  const [savingFlow, setSavingFlow] = useState(false);

  // Threat status quick-update
  const [updatingThreat, setUpdatingThreat] = useState<string | null>(null);

  // STRIDE filter
  const [strideFilter, setStrideFilter] = useState<StrideCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ThreatStatus | 'ALL'>('ALL');

  useEffect(() => {
    void reload();
  }, [id]);

  async function reload() {
    setLoading(true);
    try {
      const m = await getModel(id);
      setModel(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!model) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const r = await generateThreats(id);
      setGenResult(
        r.generated > 0 ? `Generated ${r.generated} new threats` : 'No new threats to generate',
      );
      await reload();
      setActiveTab('threats');
    } catch (e) {
      console.error(e);
      setGenResult('Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddComponent() {
    if (!compForm.name.trim()) return;
    setSavingComp(true);
    try {
      const c = await addComponent(id, {
        name: compForm.name,
        componentType: compForm.componentType,
        environment: compForm.environment,
        cloudProvider: compForm.cloudProvider || undefined,
        serviceName: compForm.serviceName || undefined,
        notes: compForm.notes || undefined,
      });
      setModel((m) => (m ? { ...m, components: [...m.components, c] } : m));
      setShowCompForm(false);
      setCompForm({
        name: '',
        componentType: 'SERVER',
        environment: 'CLOUD',
        cloudProvider: '',
        serviceName: '',
        notes: '',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingComp(false);
    }
  }

  async function handleDeleteComponent(cid: string) {
    try {
      await deleteComponent(id, cid);
      setModel((m) => (m ? { ...m, components: m.components.filter((c) => c.id !== cid) } : m));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddFlow() {
    if (!flowForm.name.trim() || !flowForm.sourceId || !flowForm.targetId) return;
    setSavingFlow(true);
    try {
      await addFlow(id, {
        name: flowForm.name,
        sourceId: flowForm.sourceId,
        targetId: flowForm.targetId,
        protocol: flowForm.protocol,
        dataClassification: flowForm.dataClassification,
        isEncrypted: flowForm.isEncrypted,
        crossesTrustBoundary: flowForm.crossesTrustBoundary,
        notes: flowForm.notes || undefined,
      });
      await reload();
      setShowFlowForm(false);
      setFlowForm({
        name: '',
        sourceId: '',
        targetId: '',
        protocol: 'HTTPS',
        dataClassification: 'INTERNAL',
        isEncrypted: true,
        crossesTrustBoundary: false,
        notes: '',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingFlow(false);
    }
  }

  async function handleDeleteFlow(fid: string) {
    try {
      await deleteFlow(id, fid);
      setModel((m) => (m ? { ...m, dataFlows: m.dataFlows.filter((f) => f.id !== fid) } : m));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleThreatStatus(t: TmThreat, status: ThreatStatus) {
    setUpdatingThreat(t.id);
    try {
      const updated = await updateThreat(id, t.id, { status });
      setModel((m) =>
        m
          ? {
              ...m,
              threats: m.threats.map((x) => (x.id === t.id ? { ...x, status: updated.status } : x)),
            }
          : m,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingThreat(null);
    }
  }

  async function handleDeleteThreat(tid: string) {
    try {
      await deleteThreat(id, tid);
      setModel((m) => (m ? { ...m, threats: m.threats.filter((t) => t.id !== tid) } : m));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleModelStatus(status: ModelStatus) {
    try {
      await updateModelStatus(id, status);
      setModel((m) => (m ? { ...m, status } : m));
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return <div className="p-6 text-zinc-500">Loading…</div>;
  if (!model) return <div className="p-6 text-zinc-500">Model not found.</div>;

  const filteredThreats = model.threats.filter((t) => {
    if (strideFilter !== 'ALL' && t.strideCategory !== strideFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const openCount = model.threats.filter((t) => t.status === 'OPEN').length;
  const criticalCount = model.threats.filter((t) => (t.riskScore ?? 0) >= 15).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => router.push('/threat-models')}
          className="mt-1 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white truncate">{model.name}</h1>
            <span
              className={`px-2 py-0.5 rounded border text-xs font-medium ${model.environment === 'CLOUD' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : model.environment === 'ONPREM' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' : 'text-purple-400 bg-purple-400/10 border-purple-400/20'}`}
            >
              {model.environment}
            </span>
            {/* Status selector */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium text-zinc-400 bg-zinc-800 border-zinc-700 hover:border-zinc-600 transition-colors">
                {model.status} <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute left-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                {(['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'] as ModelStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleModelStatus(s)}
                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${model.status === s ? 'text-white font-medium' : 'text-zinc-400'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {model.description && <p className="text-sm text-zinc-500 mt-1">{model.description}</p>}
        </div>

        {/* Generate threats button */}
        <button
          onClick={() => void handleGenerate()}
          disabled={generating || model.components.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors shrink-0"
        >
          {generating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {generating ? 'Generating…' : 'Auto-Generate Threats'}
        </button>
      </div>

      {genResult && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300">
          {genResult}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Components', value: model.components.length, color: 'text-blue-400' },
          { label: 'Data Flows', value: model.dataFlows.length, color: 'text-purple-400' },
          {
            label: 'Open Threats',
            value: openCount,
            color: openCount > 0 ? 'text-red-400' : 'text-green-400',
          },
          {
            label: 'Critical',
            value: criticalCount,
            color: criticalCount > 0 ? 'text-red-500' : 'text-zinc-400',
          },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1 w-fit">
        {(
          [
            { key: 'components', label: `Components (${model.components.length})` },
            { key: 'flows', label: `Data Flows (${model.dataFlows.length})` },
            { key: 'threats', label: `Threats (${model.threats.length})` },
            { key: 'matrix', label: 'Risk Matrix' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COMPONENTS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'components' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">
              Define the assets in scope for this threat model
            </p>
            <button
              onClick={() => setShowCompForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Component
            </button>
          </div>

          {model.components.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No components yet. Add servers, databases, APIs, and other assets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {model.components.map((c) => (
                <div
                  key={c.id}
                  className="group bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-white text-sm">{c.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{ctLabel(c.componentType)}</div>
                    </div>
                    <button
                      onClick={() => void handleDeleteComponent(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${c.environment === 'CLOUD' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-orange-400 bg-orange-400/10 border-orange-400/20'}`}
                    >
                      {c.environment}
                    </span>
                    {c.cloudProvider && (
                      <span className="text-xs px-1.5 py-0.5 rounded border text-zinc-400 bg-zinc-400/10 border-zinc-700">
                        {c.cloudProvider}
                      </span>
                    )}
                    {c.serviceName && (
                      <span className="text-xs text-zinc-600">{c.serviceName}</span>
                    )}
                  </div>
                  {c.notes && <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{c.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Add component form modal */}
          {showCompForm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">Add Component</h2>

                <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                <input
                  autoFocus
                  value={compForm.name}
                  onChange={(e) => setCompForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Payments API, User Database"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-3 focus:outline-none focus:border-red-500"
                />

                <label className="block text-xs text-zinc-400 mb-1">Component Type *</label>
                <select
                  value={compForm.componentType}
                  onChange={(e) => setCompForm((p) => ({ ...p, componentType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-red-500"
                >
                  {COMPONENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Environment *</label>
                    <div className="flex gap-2">
                      {(['CLOUD', 'ONPREM'] as const).map((env) => (
                        <button
                          key={env}
                          onClick={() => setCompForm((p) => ({ ...p, environment: env }))}
                          className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${compForm.environment === env ? (env === 'CLOUD' ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' : 'text-orange-400 bg-orange-400/10 border-orange-400/30') : 'text-zinc-500 bg-zinc-800 border-zinc-700'}`}
                        >
                          {env === 'CLOUD' ? 'Cloud' : 'On-Prem'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {compForm.environment === 'CLOUD' && (
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-400 mb-1">Cloud Provider</label>
                      <select
                        value={compForm.cloudProvider}
                        onChange={(e) =>
                          setCompForm((p) => ({ ...p, cloudProvider: e.target.value }))
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                      >
                        <option value="">None</option>
                        <option>AWS</option>
                        <option>AZURE</option>
                        <option>GCP</option>
                        <option>OTHER</option>
                      </select>
                    </div>
                  )}
                </div>

                <label className="block text-xs text-zinc-400 mb-1">Service Name / Label</label>
                <input
                  value={compForm.serviceName}
                  onChange={(e) => setCompForm((p) => ({ ...p, serviceName: e.target.value }))}
                  placeholder="e.g. RDS PostgreSQL, EC2 t3.large"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-3 focus:outline-none focus:border-red-500"
                />

                <label className="block text-xs text-zinc-400 mb-1">Notes</label>
                <textarea
                  value={compForm.notes}
                  onChange={(e) => setCompForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-4 focus:outline-none focus:border-red-500 resize-none"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCompForm(false)}
                    className="flex-1 py-2 text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleAddComponent()}
                    disabled={savingComp || !compForm.name.trim()}
                    className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {savingComp ? 'Saving…' : 'Add Component'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FLOWS TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'flows' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">Define how data moves between components</p>
            <button
              onClick={() => setShowFlowForm(true)}
              disabled={model.components.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Flow
            </button>
          </div>

          {model.components.length < 2 && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-300">
              Add at least 2 components before defining data flows.
            </div>
          )}

          {model.dataFlows.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Network className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No data flows yet. Connect components to generate flow-level threats.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {model.dataFlows.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{f.name}</span>
                      <span className="text-xs text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500 font-mono">{f.protocol}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                      <span className="text-zinc-300">{f.source.name}</span>
                      <span className="text-zinc-600">→</span>
                      <span className="text-zinc-300">{f.target.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${f.dataClassification === 'SECRET' ? 'text-red-400 bg-red-400/10 border-red-400/20' : f.dataClassification === 'CONFIDENTIAL' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' : f.dataClassification === 'INTERNAL' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' : 'text-green-400 bg-green-400/10 border-green-400/20'}`}
                    >
                      {f.dataClassification}
                    </span>
                    {!f.isEncrypted && (
                      <span className="text-xs px-1.5 py-0.5 rounded border text-red-400 bg-red-400/10 border-red-400/20">
                        Cleartext
                      </span>
                    )}
                    {f.crossesTrustBoundary && (
                      <span className="text-xs px-1.5 py-0.5 rounded border text-purple-400 bg-purple-400/10 border-purple-400/20">
                        Trust Boundary
                      </span>
                    )}
                    <button
                      onClick={() => void handleDeleteFlow(f.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flow form modal */}
          {showFlowForm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">Add Data Flow</h2>

                <label className="block text-xs text-zinc-400 mb-1">Flow Name *</label>
                <input
                  autoFocus
                  value={flowForm.name}
                  onChange={(e) => setFlowForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. User login request"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 mb-3 focus:outline-none focus:border-red-500"
                />

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Source *</label>
                    <select
                      value={flowForm.sourceId}
                      onChange={(e) => setFlowForm((p) => ({ ...p, sourceId: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                      <option value="">Select…</option>
                      {model.components.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Target *</label>
                    <select
                      value={flowForm.targetId}
                      onChange={(e) => setFlowForm((p) => ({ ...p, targetId: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                      <option value="">Select…</option>
                      {model.components.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Protocol</label>
                    <select
                      value={flowForm.protocol}
                      onChange={(e) => setFlowForm((p) => ({ ...p, protocol: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                      {[
                        'HTTPS',
                        'HTTP',
                        'gRPC',
                        'AMQP',
                        'MQTT',
                        'TLS',
                        'SQL',
                        'LDAP',
                        'LDAPS',
                        'SSH',
                        'FTP',
                        'SFTP',
                        'SMTP',
                        'SMTPS',
                        'SNMP',
                      ].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Classification</label>
                    <select
                      value={flowForm.dataClassification}
                      onChange={(e) =>
                        setFlowForm((p) => ({
                          ...p,
                          dataClassification: e.target.value as DataClassification,
                        }))
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                    >
                      {(
                        ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as DataClassification[]
                      ).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mb-4">
                  {[
                    { key: 'isEncrypted', label: 'Encrypted' },
                    { key: 'crossesTrustBoundary', label: 'Crosses Trust Boundary' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flowForm[key as keyof typeof flowForm] as boolean}
                        onChange={(e) => setFlowForm((p) => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500"
                      />
                      <span className="text-sm text-zinc-400">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFlowForm(false)}
                    className="flex-1 py-2 text-sm text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleAddFlow()}
                    disabled={
                      savingFlow ||
                      !flowForm.name.trim() ||
                      !flowForm.sourceId ||
                      !flowForm.targetId
                    }
                    className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {savingFlow ? 'Saving…' : 'Add Flow'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── THREATS TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'threats' && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap mb-4">
            <select
              value={strideFilter}
              onChange={(e) => setStrideFilter(e.target.value as StrideCategory | 'ALL')}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="ALL">All STRIDE</option>
              {(Object.keys(STRIDE_META) as StrideCategory[]).map((s) => (
                <option key={s} value={s}>
                  {STRIDE_META[s].label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ThreatStatus | 'ALL')}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="ALL">All Statuses</option>
              {(Object.keys(STATUS_META) as ThreatStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-sm text-zinc-500 self-center">
              {filteredThreats.length} threats
            </span>
          </div>

          {filteredThreats.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No threats found. Add components and click "Auto-Generate Threats".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredThreats.map((t) => {
                const rb = riskBadge(t.riskScore ?? 0);
                const sm = STRIDE_META[t.strideCategory];
                const stm = STATUS_META[t.status as ThreatStatus];
                return (
                  <div
                    key={t.id}
                    className="group bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${sm.color}`}
                        >
                          {sm.abbr}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm">{t.title}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border font-medium ${rb.color}`}
                          >
                            {rb.label}
                          </span>
                          <span className="text-xs text-zinc-600">·</span>
                          <span className="text-xs text-zinc-500">
                            L={t.likelihood} × I={t.impact} = {t.riskScore}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{t.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                          {t.attackTechnique && (
                            <span className="font-mono text-purple-400/70">
                              {t.attackTechnique}
                            </span>
                          )}
                          {t.attackTactic && <span>{t.attackTactic}</span>}
                          {t.component && <span>→ {t.component.name}</span>}
                          {t.flow && <span>→ Flow: {t.flow.name}</span>}
                          {t.isAutoGenerated && <span className="text-zinc-700">auto</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status quick-select */}
                        <select
                          value={t.status}
                          disabled={updatingThreat === t.id}
                          onChange={(e) =>
                            void handleThreatStatus(t, e.target.value as ThreatStatus)
                          }
                          className={`text-xs px-2 py-1 rounded border bg-transparent focus:outline-none cursor-pointer transition-colors ${stm.color}`}
                        >
                          {(Object.keys(STATUS_META) as ThreatStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-zinc-900 text-white">
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void handleDeleteThreat(t.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RISK MATRIX TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <RiskMatrix threats={model.threats} />
        </div>
      )}
    </div>
  );
}
