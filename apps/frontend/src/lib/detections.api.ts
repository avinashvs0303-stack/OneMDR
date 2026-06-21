import { api } from './api';

const BASE = '/detections';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DetectionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type DetectionPlatform =
  | 'SPLUNK'
  | 'SENTINEL'
  | 'CHRONICLE'
  | 'ELASTIC'
  | 'QRADAR'
  | 'DEFENDER'
  | 'SIGMA'
  | 'CUSTOM';
export type QueryLanguage = 'SPL' | 'KQL' | 'YARA_L' | 'EQL' | 'AQL' | 'SIGMA' | 'CUSTOM';
export type DetectionRuleType =
  | 'ANOMALY'
  | 'INVESTIGATE'
  | 'HIGH_FIDELITY'
  | 'CORRELATION'
  | 'THREAT_INTEL';
export type DetectionLifecycle = 'EXPERIMENTAL' | 'FUNCTIONAL' | 'STABLE' | 'RETIRED';
export type DetectionWorkflowStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'APPROVED'
  | 'ENABLED'
  | 'DISABLED';

export interface DetectionRow {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: DetectionSeverity;
  platform: DetectionPlatform;
  mitreAttackId: string | null;
  mitreTactic: string | null;
  mitreTechnique: string | null;
  nistControls: string[];
  dataSources: string[];
  logSources: string[];
  deviceTypes: string[];
  query: string;
  queryLanguage: QueryLanguage;
  tags: string[];
  expectedAlertsPerDay: number | null;
  expectedFpRate: number | null;
  expectedMttdHours: number | null;
  isGlobal: boolean;
  isEnabled: boolean;
  isCustom: boolean;
  ruleType: DetectionRuleType | null;
  lifecycleStage: DetectionLifecycle;
  workflowStatus: DetectionWorkflowStatus;
  ownerName: string | null;
  stats: { triggerCount: number; truePositives: number; falsePositives: number };
  createdAt: string;
  updatedAt: string;
}

export interface TenantLogSource {
  id: string;
  tenantId: string;
  logSource: string;
  deviceType: string | null;
  vendor: string | null;
  createdAt: string;
}

export interface DetectionProposal {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: DetectionSeverity;
  platform: DetectionPlatform;
  mitreAttackId: string | null;
  mitreTactic: string | null;
  logSources: string[];
  deviceTypes: string[];
  matchedSources: string[];
}

export interface ProposalsResponse {
  proposals: DetectionProposal[];
  totalLogSources: number;
  registeredSources?: string[];
  message?: string;
}

export interface DetectionStat {
  date: string;
  triggerCount: number;
  truePositives: number;
  falsePositives: number;
  mttdMinutes: number | null;
}

export interface CreateDetectionPayload {
  name: string;
  description: string;
  severity: DetectionSeverity;
  platform: DetectionPlatform;
  query: string;
  queryLanguage: QueryLanguage;
  mitreAttackId?: string;
  mitreTactic?: string;
  mitreTechnique?: string;
  nistControls?: string[];
  dataSources?: string[];
  tags?: string[];
  expectedAlertsPerDay?: number;
  expectedFpRate?: number;
  expectedMttdHours?: number;
  ruleType?: DetectionRuleType;
  lifecycleStage?: DetectionLifecycle;
  workflowStatus?: DetectionWorkflowStatus;
}

export interface SplunkJobRun {
  sid: string;
  published: string;
  eventCount: number;
  resultCount: number;
  runDuration: number;
  isDone: boolean;
  dispatchState: string;
}

export interface SplunkHistoryResult {
  runs: SplunkJobRun[];
  totalRuns: number;
  triggeredRuns: number;
}

export interface ListDetectionsParams {
  platform?: string;
  severity?: string;
  search?: string;
  tactic?: string;
  enabled?: 'true' | 'false';
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface DashboardSummary {
  totalDetections: number;
  enabledDetections: number;
  byPlatform: Record<string, number>;
  bySeverity: Record<string, number>;
  byTactic: Record<string, number>;
  avgFpRate: number | null;
  avgMttdHours: number | null;
  totalAlertsPerDay: number | null;
  techniqueCountMap: Record<string, number>;
  recentDetections: Array<{
    id: string;
    ruleId: string;
    name: string;
    mitreAttackId: string | null;
    mitreTactic: string | null;
    severity: string;
    platform: string;
    expectedFpRate: number | null;
    expectedAlertsPerDay: number | null;
    isEnabled: boolean;
    updatedAt: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert an ArrayBuffer/File to base64 string for the import API.
export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const detectionsApi = {
  list: async (params?: ListDetectionsParams): Promise<DetectionRow[]> => {
    const q = new URLSearchParams();
    if (params?.platform) q.set('platform', params.platform);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.search) q.set('search', params.search);
    if (params?.tactic) q.set('tactic', params.tactic);
    if (params?.enabled) q.set('enabled', params.enabled);
    const qs = q.toString();
    const res = await api.get<{ data: DetectionRow[] }>(`${BASE}${qs ? `?${qs}` : ''}`);
    return res.data;
  },

  get: async (id: string): Promise<DetectionRow & { stats: DetectionStat[] }> => {
    const res = await api.get<{ data: DetectionRow & { stats: DetectionStat[] } }>(`${BASE}/${id}`);
    return res.data;
  },

  toggle: async (id: string, enable: boolean): Promise<void> => {
    await api.patch(`${BASE}/${id}/toggle`, { enable });
  },

  create: async (payload: CreateDetectionPayload): Promise<DetectionRow> => {
    const res = await api.post<{ data: DetectionRow }>(`${BASE}`, payload);
    return res.data;
  },

  importFile: async (file: File): Promise<ImportResult> => {
    const data = await fileToBase64(file);
    const res = await api.post<{ data: ImportResult }>(`${BASE}/import`, {
      filename: file.name,
      data,
    });
    return res.data;
  },

  getStats: async (id: string): Promise<DetectionStat[]> => {
    const res = await api.get<{ data: DetectionStat[] }>(`${BASE}/${id}/stats`);
    return res.data;
  },

  summary: async (): Promise<DashboardSummary> => {
    const res = await api.get<{ data: DashboardSummary }>(`${BASE}/summary`);
    return res.data;
  },

  listLogSources: async (): Promise<TenantLogSource[]> => {
    const res = await api.get<{ data: TenantLogSource[] }>(`${BASE}/log-sources`);
    return res.data;
  },

  addLogSource: async (payload: {
    logSource: string;
    deviceType?: string;
    vendor?: string;
  }): Promise<TenantLogSource> => {
    const res = await api.post<{ data: TenantLogSource }>(`${BASE}/log-sources`, payload);
    return res.data;
  },

  removeLogSource: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/log-sources/${id}`);
  },

  proposals: async (): Promise<ProposalsResponse> => {
    const res = await api.get<{ data: ProposalsResponse }>(`${BASE}/proposals`);
    return res.data;
  },

  bulkToggle: async (ids: string[], enable: boolean): Promise<void> => {
    await api.patch(`${BASE}/bulk-toggle`, { ids, enable });
  },

  update: async (id: string, payload: Partial<CreateDetectionPayload>): Promise<DetectionRow> => {
    const res = await api.patch<{ data: DetectionRow }>(`${BASE}/${id}`, payload);
    return res.data;
  },

  duplicate: async (id: string): Promise<DetectionRow> => {
    const res = await api.post<{ data: DetectionRow }>(`${BASE}/${id}/duplicate`, {});
    return res.data;
  },
};

// ── Display helpers ───────────────────────────────────────────────────────────

export const RULE_TYPE_LABEL: Record<DetectionRuleType, string> = {
  ANOMALY: 'Anomaly',
  INVESTIGATE: 'Investigate',
  HIGH_FIDELITY: 'High Fidelity',
  CORRELATION: 'Correlation',
  THREAT_INTEL: 'Threat Intel',
};

export const LIFECYCLE_LABEL: Record<DetectionLifecycle, string> = {
  EXPERIMENTAL: 'Experimental',
  FUNCTIONAL: 'Functional',
  STABLE: 'Stable',
  RETIRED: 'Retired',
};

export const WORKFLOW_STATUS_LABEL: Record<DetectionWorkflowStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  APPROVED: 'Approved',
  ENABLED: 'Enabled',
  DISABLED: 'Disabled',
};

export const WORKFLOW_STATUS_COLORS: Record<DetectionWorkflowStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ENABLED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DISABLED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export const LIFECYCLE_COLORS: Record<DetectionLifecycle, string> = {
  EXPERIMENTAL: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  FUNCTIONAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  STABLE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  RETIRED: 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
};

export const SEVERITY_LABEL: Record<DetectionSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Info',
};

export const PLATFORM_LABEL: Record<DetectionPlatform, string> = {
  SPLUNK: 'Splunk',
  SENTINEL: 'Sentinel',
  CHRONICLE: 'Chronicle',
  ELASTIC: 'Elastic',
  QRADAR: 'QRadar',
  DEFENDER: 'Defender',
  SIGMA: 'SIGMA',
  CUSTOM: 'Custom',
};

export const QUERY_LANG_LABEL: Record<QueryLanguage, string> = {
  SPL: 'SPL',
  KQL: 'KQL',
  YARA_L: 'YARA-L',
  EQL: 'EQL',
  AQL: 'AQL',
  SIGMA: 'SIGMA',
  CUSTOM: 'Custom',
};

export const SEVERITY_COLORS: Record<DetectionSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INFO: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
};

export const PLATFORM_COLORS: Record<DetectionPlatform, string> = {
  SPLUNK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SENTINEL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CHRONICLE: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ELASTIC: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  QRADAR: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  DEFENDER: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SIGMA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CUSTOM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};
