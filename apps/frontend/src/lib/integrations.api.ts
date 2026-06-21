import { api } from './api';
import type { DetectionPlatform } from './detections.api';

const BASE = '/integrations';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntegrationStatus = 'UNCONFIGURED' | 'CONNECTED' | 'ERROR' | 'DEGRADED';

export interface IntegrationRow {
  id: string;
  tenantId: string;
  platform: DetectionPlatform;
  name: string;
  host: string;
  config: Record<string, string>;
  status: IntegrationStatus;
  lastTestedAt: string | null;
  errorMessage: string | null;
  isEnabled: boolean;
  deployedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiemDeployment {
  id: string;
  integrationId: string;
  detectionId: string;
  remoteId: string | null;
  status: 'deployed' | 'error' | 'removed';
  errorMessage: string | null;
  deployedAt: string;
  integration: {
    id: string;
    name: string;
    platform: DetectionPlatform;
    isEnabled: boolean;
    status: IntegrationStatus;
  };
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface IntegrationLog {
  id: string;
  tenantId: string;
  integrationId: string;
  event: string;
  level: LogLevel;
  message: string;
  meta: Record<string, unknown> | null;
  durationMs: number | null;
  createdAt: string;
  integration: { id: string; name: string; platform: string };
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

export interface CreateIntegrationPayload {
  platform: DetectionPlatform;
  name: string;
  host: string;
  config?: Record<string, string>;
  isEnabled?: boolean;
}

export interface UpdateIntegrationPayload {
  name?: string;
  host?: string;
  config?: Record<string, string>;
  isEnabled?: boolean;
}

export interface TestResult {
  success: boolean;
  error?: string;
}

// ── API client ────────────────────────────────────────────────────────────────

export const integrationsApi = {
  list: (): Promise<IntegrationRow[]> => api.get(BASE),

  get: (id: string): Promise<IntegrationRow & { deployments: SiemDeployment[] }> =>
    api.get(`${BASE}/${id}`),

  create: (payload: CreateIntegrationPayload): Promise<IntegrationRow> => api.post(BASE, payload),

  update: (id: string, payload: UpdateIntegrationPayload): Promise<IntegrationRow> =>
    api.patch(`${BASE}/${id}`, payload),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`),

  test: (id: string): Promise<TestResult> => api.post(`${BASE}/${id}/test`, {}),

  deploy: (integrationId: string, detectionId: string): Promise<SiemDeployment> =>
    api.post(`${BASE}/${integrationId}/deploy/${detectionId}`, {}),

  undeploy: (integrationId: string, detectionId: string): Promise<SiemDeployment> =>
    api.delete(`${BASE}/${integrationId}/deploy/${detectionId}`),

  listDeployments: (detectionId: string): Promise<SiemDeployment[]> =>
    api.get(`${BASE}/deployments/${detectionId}`),

  getLogs: (integrationId?: string, limit?: number): Promise<IntegrationLog[]> => {
    const params = new URLSearchParams();
    if (integrationId) params.set('integrationId', integrationId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return api.get(`${BASE}/activity${qs ? `?${qs}` : ''}`);
  },

  fetchSplunkHistory: (
    integrationId: string,
    detectionId: string,
  ): Promise<{ runs: SplunkJobRun[]; totalRuns: number; triggeredRuns: number }> =>
    api.get(`${BASE}/${integrationId}/history/${detectionId}`),
};

// ── Platform metadata ─────────────────────────────────────────────────────────

export const PLATFORM_INFO: Record<
  DetectionPlatform,
  {
    label: string;
    color: string;
    bg: string;
    fields: Array<{
      key: string;
      label: string;
      type?: 'password' | 'text';
      required?: boolean;
      placeholder?: string;
    }>;
    defaultHost: string;
  }
> = {
  SPLUNK: {
    label: 'Splunk Enterprise Security',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
    fields: [
      {
        key: 'port',
        label: 'Management Port — leave blank for Splunk Cloud, set 8089 for On-Prem',
        placeholder: '8089',
      },
      {
        key: 'apiToken',
        label: 'API Token — connection test (Cloud) · deploy + connection test (On-Prem)',
        type: 'password',
        required: false,
        placeholder: 'eyJrIjoixx...',
      },
      {
        key: 'username',
        label: 'Username — Splunk Cloud deploy only',
        required: false,
        placeholder: 'admin',
      },
      {
        key: 'password',
        label: 'Password — Splunk Cloud deploy only',
        type: 'password',
        required: false,
        placeholder: '••••••••',
      },
    ],
    defaultHost: 'https://splunk.example.com',
  },
  QRADAR: {
    label: 'IBM QRadar',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    fields: [
      {
        key: 'apiToken',
        label: 'SEC Token',
        type: 'password',
        required: true,
        placeholder: 'qradar-sec-token',
      },
    ],
    defaultHost: 'https://qradar.example.com',
  },
  SENTINEL: {
    label: 'Microsoft Sentinel',
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
    fields: [
      {
        key: 'subscriptionId',
        label: 'Subscription ID',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'resourceGroup',
        label: 'Resource Group',
        required: true,
        placeholder: 'my-resource-group',
      },
      {
        key: 'workspaceName',
        label: 'Workspace Name',
        required: true,
        placeholder: 'my-sentinel-workspace',
      },
      {
        key: 'tenantAadId',
        label: 'Azure Tenant ID',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'clientId',
        label: 'App (Client) ID',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'your-client-secret',
      },
    ],
    defaultHost: 'https://management.azure.com',
  },
  DEFENDER: {
    label: 'Microsoft 365 Defender',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
    fields: [
      {
        key: 'tenantAadId',
        label: 'Azure Tenant ID',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'clientId',
        label: 'App (Client) ID',
        required: true,
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'your-client-secret',
      },
    ],
    defaultHost: 'https://api.security.microsoft.com',
  },
  CHRONICLE: {
    label: 'Google Chronicle',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    fields: [
      {
        key: 'serviceAccountToken',
        label: 'Service Account Bearer Token',
        type: 'password',
        required: true,
        placeholder: 'ya29.xxx...',
      },
    ],
    defaultHost: 'https://backstory.googleapis.com',
  },
  ELASTIC: {
    label: 'Elastic Security',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key (leave blank for user/pass)',
        type: 'password',
        placeholder: 'base64EncodedApiKey',
      },
      { key: 'username', label: 'Username (if no API key)', placeholder: 'elastic' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
    defaultHost: 'https://elastic.example.com:5601',
  },
  SIGMA: {
    label: 'SIGMA Rules',
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    fields: [],
    defaultHost: '',
  },
  CUSTOM: {
    label: 'Custom Integration',
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20',
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'optional-token' },
    ],
    defaultHost: 'https://your-siem.example.com',
  },
};

export const STATUS_BADGE: Record<IntegrationStatus, { label: string; className: string }> = {
  UNCONFIGURED: {
    label: 'Not configured',
    className:
      'bg-slate-100 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-500/20',
  },
  CONNECTED: {
    label: 'Connected',
    className:
      'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  },
  ERROR: {
    label: 'Error',
    className:
      'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  },
  DEGRADED: {
    label: 'Degraded',
    className:
      'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
};
