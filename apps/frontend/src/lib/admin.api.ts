import { api } from './api';

const BASE = '/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type TenantType = 'STANDARD' | 'MSSP';
export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  tenantType: TenantType;
  isActive: boolean;
  maxUsers: number;
  maxSubTenants: number | null;
  licenseModules: string[];
  licenseExpiresAt: string | null;
  createdAt: string;
  _count: { users: number };
}

export interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  supabaseUid: string | null;
}

export interface TenantDetail extends TenantSummary {
  users: TenantUser[];
  tenantRequest: {
    companySize: string | null;
    industry: string | null;
    website: string | null;
    contactPhone: string | null;
    useCase: string | null;
    reviewedAt: string | null;
    adminNotes: string | null;
  } | null;
}

export interface AdminOverview {
  requests: { pending: number; overdue: number };
  tenants: { total: number; active: number; suspended: number };
  licenses: { expiring30: number; expiring60: number; expiring90: number };
  recentRequests: Array<{
    id: string;
    companyName: string;
    contactEmail: string;
    industry: string | null;
    createdAt: string;
    status: string;
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    plan: TenantPlan;
    isActive: boolean;
    createdAt: string;
    licenseExpiresAt: string | null;
  }>;
}

export interface ExpiringLicense {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  licenseExpiresAt: string;
  licenseModules: string[];
  maxUsers: number;
  _count: { users: number };
}

export interface UpdateLicensePayload {
  planType: TenantPlan;
  tenantType?: TenantType;
  maxUsers: number;
  maxSubTenants?: number;
  licenseModules: string[];
  licenseExpiresAt?: string;
  adminNotes?: string;
}

export interface CreateTenantPayload {
  companyName: string;
  contactName: string;
  contactEmail: string;
  planType: TenantPlan;
  tenantType?: TenantType;
  maxUsers: number;
  maxSubTenants?: number;
  licenseModules: string[];
  licenseExpiresAt?: string;
  adminNotes?: string;
}

export interface InviteUserPayload {
  email: string;
  name: string;
  role?: 'ADMIN' | 'MEMBER' | 'GUEST';
}

// ── Lead types ────────────────────────────────────────────────────────────────

export type LeadStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Lead {
  id: string;
  companyName: string;
  companySize: string | null;
  industry: string | null;
  website: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  useCase: string | null;
  status: LeadStatus;
  planType: TenantPlan;
  tenantType: TenantType;
  maxUsers: number;
  maxSubTenants: number | null;
  licenseModules: string[];
  licenseExpiresAt: string | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

export interface ProvisionLeadPayload {
  planType: TenantPlan;
  tenantType?: TenantType;
  maxUsers: number;
  maxSubTenants?: number;
  licenseModules: string[];
  licenseExpiresAt?: string;
  adminNotes?: string;
}

export interface DeclineLeadPayload {
  rejectionReason: string;
  adminNotes?: string;
}

// ── Support case types ────────────────────────────────────────────────────────

export type SupportCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SupportCase {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  priority: SupportCasePriority;
  status: SupportCaseStatus;
  submittedByEmail: string;
  submittedByName: string;
  assignedToEmail: string | null;
  internalNotes: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  tenant: { id: string; name: string; slug: string };
}

export interface UpdateSupportCasePayload {
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  assignedToEmail?: string;
  internalNotes?: string;
  resolutionNotes?: string;
}

export interface CreateSupportCasePayload {
  tenantId: string;
  title: string;
  description: string;
  priority?: SupportCasePriority;
  submittedByEmail: string;
  submittedByName: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const adminApi = {
  // Overview
  getOverview: async (): Promise<AdminOverview> => {
    const res = await api.get<{ data: AdminOverview }>(`${BASE}/overview`);
    return res.data;
  },

  // Tenants
  listTenants: async (params?: {
    search?: string;
    plan?: string;
    status?: string;
  }): Promise<TenantSummary[]> => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.plan) q.set('plan', params.plan);
    if (params?.status) q.set('status', params.status);
    const res = await api.get<{ data: TenantSummary[] }>(
      `${BASE}/tenants${q.toString() ? `?${q.toString()}` : ''}`,
    );
    return res.data;
  },

  createTenant: async (
    payload: CreateTenantPayload,
  ): Promise<{ tenantId: string; slug: string; message: string }> => {
    const res = await api.post<{ data: { tenantId: string; slug: string; message: string } }>(
      `${BASE}/tenants`,
      payload,
    );
    return res.data;
  },

  getTenant: async (id: string): Promise<TenantDetail> => {
    const res = await api.get<{ data: TenantDetail }>(`${BASE}/tenants/${id}`);
    return res.data;
  },

  updateLicense: async (id: string, payload: UpdateLicensePayload): Promise<void> => {
    await api.patch(`${BASE}/tenants/${id}/license`, payload);
  },

  suspendTenant: async (id: string): Promise<{ message: string }> => {
    const res = await api.patch<{ data: { message: string } }>(`${BASE}/tenants/${id}/suspend`);
    return res.data;
  },

  reactivateTenant: async (id: string): Promise<{ message: string }> => {
    const res = await api.patch<{ data: { message: string } }>(`${BASE}/tenants/${id}/reactivate`);
    return res.data;
  },

  // Users
  inviteUser: async (tenantId: string, payload: InviteUserPayload): Promise<{ userId: string }> => {
    const res = await api.post<{ data: { userId: string } }>(
      `${BASE}/tenants/${tenantId}/users`,
      payload,
    );
    return res.data;
  },

  deactivateUser: async (tenantId: string, userId: string): Promise<void> => {
    await api.delete(`${BASE}/tenants/${tenantId}/users/${userId}`);
  },

  // Licenses
  getExpiringLicenses: async (days = 90): Promise<ExpiringLicense[]> => {
    const res = await api.get<{ data: ExpiringLicense[] }>(
      `${BASE}/licenses/expiring?days=${days}`,
    );
    return res.data;
  },

  // Leads
  listLeads: async (status?: LeadStatus): Promise<Lead[]> => {
    const q = status ? `?status=${status}` : '';
    const res = await api.get<{ data: Lead[] }>(`${BASE}/leads${q}`);
    return res.data;
  },

  getLead: async (id: string): Promise<Lead> => {
    const res = await api.get<{ data: Lead }>(`${BASE}/leads/${id}`);
    return res.data;
  },

  provisionLead: async (
    id: string,
    payload: ProvisionLeadPayload,
  ): Promise<{ request: Lead; tempPassword: string }> => {
    const res = await api.patch<{ data: { request: Lead; tempPassword: string } }>(
      `${BASE}/leads/${id}/provision`,
      payload,
    );
    return res.data;
  },

  declineLead: async (id: string, payload: DeclineLeadPayload): Promise<Lead> => {
    const res = await api.patch<{ data: Lead }>(`${BASE}/leads/${id}/decline`, payload);
    return res.data;
  },

  // Support Cases
  listSupportCases: async (params?: {
    status?: SupportCaseStatus;
    priority?: SupportCasePriority;
    tenantId?: string;
  }): Promise<SupportCase[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.priority) q.set('priority', params.priority);
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    const qs = q.toString();
    const res = await api.get<{ data: SupportCase[] }>(
      `${BASE}/support-cases${qs ? `?${qs}` : ''}`,
    );
    return res.data;
  },

  createSupportCase: async (payload: CreateSupportCasePayload): Promise<SupportCase> => {
    const res = await api.post<{ data: SupportCase }>(`${BASE}/support-cases`, payload);
    return res.data;
  },

  updateSupportCase: async (
    id: string,
    payload: UpdateSupportCasePayload,
  ): Promise<SupportCase> => {
    const res = await api.patch<{ data: SupportCase }>(`${BASE}/support-cases/${id}`, payload);
    return res.data;
  },
};
