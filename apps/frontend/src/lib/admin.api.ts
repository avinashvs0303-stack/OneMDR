import { api } from './api';

const BASE = '/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  isActive: boolean;
  maxUsers: number;
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
  maxUsers: number;
  licenseModules: string[];
  licenseExpiresAt?: string;
  adminNotes?: string;
}

export interface InviteUserPayload {
  email: string;
  name: string;
  role?: 'ADMIN' | 'MEMBER' | 'GUEST';
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
};
