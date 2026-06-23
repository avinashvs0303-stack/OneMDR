import { api } from './api';

const BASE = '/hunts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HuntStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETE' | 'ARCHIVED';
export type HuntPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type HuntEvidenceType = 'FINDING' | 'FALSE_POSITIVE' | 'ARTIFACT' | 'NOTE';
export type HuntIOCType =
  | 'IP'
  | 'DOMAIN'
  | 'HASH_MD5'
  | 'HASH_SHA1'
  | 'HASH_SHA256'
  | 'URL'
  | 'EMAIL'
  | 'REGISTRY_KEY'
  | 'FILE_PATH'
  | 'OTHER';
export type EvidenceSeverity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type IOCConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface HuntEvidence {
  id: string;
  missionId: string;
  tenantId: string;
  type: HuntEvidenceType;
  title: string;
  body: string;
  severity: EvidenceSeverity;
  isFalsePositive: boolean;
  rawData: Record<string, unknown> | null;
  analystId: string | null;
  analystName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HuntIOC {
  id: string;
  missionId: string;
  tenantId: string;
  type: HuntIOCType;
  value: string;
  confidence: IOCConfidence;
  notes: string | null;
  createdAt: string;
  mission?: { id: string; missionRef: string; title: string };
}

export interface HuntMission {
  id: string;
  tenantId: string;
  missionRef: string;
  title: string;
  hypothesis: string;
  status: HuntStatus;
  priority: HuntPriority;
  tacticId: string | null;
  tactic: string | null;
  techniques: string[];
  analystId: string | null;
  analystName: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { evidence: number; iocs: number };
  evidence?: HuntEvidence[];
  iocs?: HuntIOC[];
}

export interface THaaSStats {
  total: number;
  active: number;
  complete: number;
  planned: number;
  critical: number;
  evidenceCount: number;
  iocCount: number;
  schedulesCount: number;
  recentMissions: HuntMission[];
}

// ── Playbook types ────────────────────────────────────────────────────────────

export interface PlaybookQuery {
  name: string;
  description: string;
  query: string;
  earliest: string;
  latest: string;
}

export interface HuntPlaybook {
  id: string;
  tenantId: string | null;
  playbookRef: string;
  title: string;
  description: string;
  category: string;
  mitreTacticId: string | null;
  mitreTactic: string | null;
  mitreTechniques: string[];
  severity: string;
  estimatedHours: number;
  tags: string[];
  queries: PlaybookQuery[];
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { schedules: number };
  schedules?: HuntSchedule[];
}

export interface HuntSchedule {
  id: string;
  tenantId: string;
  playbookId: string;
  integrationId: string;
  scheduleRef: string;
  name: string;
  cronExpression: string;
  isEnabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  autoCreateMission: boolean;
  minResultCount: number;
  createdAt: string;
  updatedAt: string;
  playbook?: Pick<HuntPlaybook, 'id' | 'playbookRef' | 'title' | 'category' | 'severity'>;
  integration?: { id: string; name: string; platform: string; status: string };
  runs?: HuntScheduleRun[];
}

export interface HuntScheduleRun {
  id: string;
  scheduleId: string;
  tenantId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'NO_RESULTS';
  resultCount: number;
  missionId: string | null;
  errorMessage: string | null;
  querySummary: unknown | null;
}

export interface PlaybookSearchResult {
  sid: string;
  resultCount: number;
  fields: string[];
  results: Array<Record<string, string>>;
}

export interface CreatePlaybookPayload {
  title: string;
  description: string;
  category: string;
  mitreTacticId?: string;
  mitreTactic?: string;
  mitreTechniques?: string[];
  severity?: string;
  estimatedHours?: number;
  tags?: string[];
  queries?: PlaybookQuery[];
}

export interface CreateSchedulePayload {
  playbookId: string;
  integrationId: string;
  name: string;
  cronExpression: string;
  isEnabled?: boolean;
  autoCreateMission?: boolean;
  minResultCount?: number;
}

export interface CreateHuntMissionPayload {
  title: string;
  hypothesis: string;
  priority?: HuntPriority;
  tacticId?: string;
  tactic?: string;
  techniques?: string[];
  analystName?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateHuntMissionPayload {
  title?: string;
  hypothesis?: string;
  status?: HuntStatus;
  priority?: HuntPriority;
  tacticId?: string;
  tactic?: string;
  techniques?: string[];
  analystName?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
}

export interface CreateEvidencePayload {
  type?: HuntEvidenceType;
  title: string;
  body: string;
  severity?: EvidenceSeverity;
  isFalsePositive?: boolean;
  analystName?: string;
}

export interface CreateIOCPayload {
  type: HuntIOCType;
  value: string;
  confidence?: IOCConfidence;
  notes?: string;
}

// ── API client ────────────────────────────────────────────────────────────────

export const huntsApi = {
  stats: (): Promise<THaaSStats> => api.get(`${BASE}/stats`),

  // Playbooks
  listPlaybooks: (): Promise<HuntPlaybook[]> => api.get(`${BASE}/playbooks`),
  getPlaybook: (id: string): Promise<HuntPlaybook> => api.get(`${BASE}/playbooks/${id}`),
  createPlaybook: (payload: CreatePlaybookPayload): Promise<HuntPlaybook> =>
    api.post(`${BASE}/playbooks`, payload),
  updatePlaybook: (id: string, payload: Partial<CreatePlaybookPayload>): Promise<HuntPlaybook> =>
    api.patch(`${BASE}/playbooks/${id}`, payload),
  deletePlaybook: (id: string): Promise<void> => api.delete(`${BASE}/playbooks/${id}`),
  launchPlaybook: (
    id: string,
    payload?: { analystName?: string; notes?: string },
  ): Promise<{ mission: HuntMission; playbook: HuntPlaybook }> =>
    api.post(`${BASE}/playbooks/${id}/launch`, payload ?? {}),
  runPlaybookQuery: (payload: {
    integrationId: string;
    query: string;
    earliest?: string;
    latest?: string;
  }): Promise<PlaybookSearchResult> => api.post(`${BASE}/playbooks/run-query`, payload),

  // Schedules
  listSchedules: (): Promise<HuntSchedule[]> => api.get(`${BASE}/schedules`),
  getSchedule: (id: string): Promise<HuntSchedule> => api.get(`${BASE}/schedules/${id}`),
  createSchedule: (payload: CreateSchedulePayload): Promise<HuntSchedule> =>
    api.post(`${BASE}/schedules`, payload),
  updateSchedule: (
    id: string,
    payload: Partial<
      CreateSchedulePayload & {
        isEnabled: boolean;
        autoCreateMission: boolean;
        minResultCount: number;
      }
    >,
  ): Promise<HuntSchedule> => api.patch(`${BASE}/schedules/${id}`, payload),
  deleteSchedule: (id: string): Promise<void> => api.delete(`${BASE}/schedules/${id}`),
  triggerSchedule: (
    id: string,
  ): Promise<{ run: string; status: string; totalResults: number; missionId: string | null }> =>
    api.post(`${BASE}/schedules/${id}/trigger`, {}),

  list: (params?: { status?: HuntStatus; priority?: HuntPriority }): Promise<HuntMission[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.priority) qs.set('priority', params.priority);
    const q = qs.toString();
    return api.get(`${BASE}${q ? `?${q}` : ''}`);
  },

  get: (id: string): Promise<HuntMission> => api.get(`${BASE}/${id}`),

  create: (payload: CreateHuntMissionPayload): Promise<HuntMission> => api.post(BASE, payload),

  update: (id: string, payload: UpdateHuntMissionPayload): Promise<HuntMission> =>
    api.patch(`${BASE}/${id}`, payload),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`),

  addEvidence: (missionId: string, payload: CreateEvidencePayload): Promise<HuntEvidence> =>
    api.post(`${BASE}/${missionId}/evidence`, payload),

  removeEvidence: (missionId: string, evidenceId: string): Promise<void> =>
    api.delete(`${BASE}/${missionId}/evidence/${evidenceId}`),

  addIOC: (missionId: string, payload: CreateIOCPayload): Promise<HuntIOC> =>
    api.post(`${BASE}/${missionId}/iocs`, payload),

  removeIOC: (missionId: string, iocId: string): Promise<void> =>
    api.delete(`${BASE}/${missionId}/iocs/${iocId}`),

  listIOCs: (type?: HuntIOCType): Promise<HuntIOC[]> => {
    const q = type ? `?type=${type}` : '';
    return api.get(`${BASE}/iocs${q}`);
  },
};

// ── UI metadata ───────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<HuntStatus, { dot: string; badge: string; label: string }> = {
  ACTIVE: {
    label: 'Active',
    dot: 'bg-emerald-500 animate-pulse',
    badge: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  PLANNED: {
    label: 'Planned',
    dot: 'bg-amber-500',
    badge: 'text-amber-700 dark:text-amber-400 bg-amber-500/15 border-amber-500/30',
  },
  COMPLETE: {
    label: 'Complete',
    dot: 'bg-slate-400 dark:bg-zinc-500',
    badge:
      'text-slate-600 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/15',
  },
  ARCHIVED: {
    label: 'Archived',
    dot: 'bg-slate-300 dark:bg-zinc-600',
    badge:
      'text-slate-400 dark:text-zinc-500 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10',
  },
};

export const PRIORITY_CONFIG: Record<HuntPriority, { label: string; className: string }> = {
  CRITICAL: {
    label: 'Critical',
    className: 'text-red-700 dark:text-red-400 bg-red-500/15 border border-red-500/30',
  },
  HIGH: {
    label: 'High',
    className: 'text-orange-700 dark:text-orange-400 bg-orange-500/15 border border-orange-500/30',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'text-amber-700 dark:text-amber-400 bg-amber-500/15 border border-amber-500/20',
  },
  LOW: {
    label: 'Low',
    className: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border border-slate-500/20',
  },
};

export const EVIDENCE_TYPE_CONFIG: Record<HuntEvidenceType, { label: string; color: string }> = {
  FINDING: { label: 'Finding', color: 'text-red-700 dark:text-red-400' },
  FALSE_POSITIVE: { label: 'False Positive', color: 'text-slate-500 dark:text-zinc-400' },
  ARTIFACT: { label: 'Artifact', color: 'text-blue-700 dark:text-blue-400' },
  NOTE: { label: 'Note', color: 'text-amber-700 dark:text-amber-400' },
};

export const IOC_TYPE_LABELS: Record<HuntIOCType, string> = {
  IP: 'IP Address',
  DOMAIN: 'Domain',
  HASH_MD5: 'MD5 Hash',
  HASH_SHA1: 'SHA1 Hash',
  HASH_SHA256: 'SHA256 Hash',
  URL: 'URL',
  EMAIL: 'Email',
  REGISTRY_KEY: 'Registry Key',
  FILE_PATH: 'File Path',
  OTHER: 'Other',
};

export const TACTIC_OPTIONS = [
  { id: 'TA0043', name: 'Reconnaissance' },
  { id: 'TA0042', name: 'Resource Development' },
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0040', name: 'Impact' },
];
