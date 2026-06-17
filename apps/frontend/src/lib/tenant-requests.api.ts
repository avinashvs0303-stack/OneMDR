import { api } from './api';

export interface TenantRequest {
  id: string;
  companyName: string;
  companySize: string | null;
  industry: string | null;
  website: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  useCase: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  planType: 'FREE' | 'PRO' | 'ENTERPRISE';
  maxUsers: number;
  licenseModules: string[];
  licenseExpiresAt: string | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  tenantId: string | null;
}

export interface SubmitRequestPayload {
  companyName: string;
  companySize?: string;
  industry?: string;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  useCase?: string;
}

export interface ApprovePayload {
  planType: 'FREE' | 'PRO' | 'ENTERPRISE';
  maxUsers: number;
  licenseModules: string[];
  licenseExpiresAt?: string;
  adminNotes?: string;
}

export interface RejectPayload {
  rejectionReason: string;
  adminNotes?: string;
}

export const tenantRequestsApi = {
  submit: (data: SubmitRequestPayload) =>
    api.post<{ data: { id: string; status: string; message: string } }>('/tenant-requests', data),

  list: (status?: 'PENDING' | 'APPROVED' | 'REJECTED') =>
    api.get<{ data: TenantRequest[] }>(
      status ? `/tenant-requests?status=${status}` : '/tenant-requests',
    ),

  getOne: (id: string) => api.get<{ data: TenantRequest }>(`/tenant-requests/${id}`),

  approve: (id: string, data: ApprovePayload) =>
    api.patch<{ data: { request: TenantRequest; tempPassword: string } }>(
      `/tenant-requests/${id}/approve`,
      data,
    ),

  reject: (id: string, data: RejectPayload) =>
    api.patch<{ data: TenantRequest }>(`/tenant-requests/${id}/reject`, data),
};
