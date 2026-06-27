/**
 * Auth-related API calls to Railway (NestJS backend).
 *
 * Login, logout, registration, and password reset are now handled by Supabase Auth
 * directly from the frontend — no Railway involvement for these flows.
 *
 * This file contains MFA management, profile updates, member listing, tenant
 * settings, and activity feed calls.
 */

import { api } from './api';

export type { AuthUser } from '@/store/auth.store';

const BASE = '/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export interface TenantMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  tenantType: string;
  isActive: boolean;
  maxUsers: number;
  licenseModules: string[];
  licenseExpiresAt: string | null;
  trialEndsAt: string | null;
  billingEmail: string | null;
  mfaEnforced: boolean;
  _count: { users: number };
}

export interface ActivityEvent {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string; role: string } | null;
}

// ── Profile management ────────────────────────────────────────────────────────

export async function updateProfile(dto: {
  firstName?: string;
  lastName?: string;
  timezone?: string;
}): Promise<void> {
  await api.patch(`${BASE}/me`, dto);
}

// ── Team members ──────────────────────────────────────────────────────────────

export async function listMembers(): Promise<TenantMember[]> {
  const res = await api.get<{ data: TenantMember[] }>(`${BASE}/members`);
  return res.data;
}

// ── Tenant / workspace settings ───────────────────────────────────────────────

export async function getTenant(): Promise<TenantInfo> {
  const res = await api.get<{ data: TenantInfo }>(`${BASE}/tenant`);
  return res.data;
}

export async function updateTenant(dto: { name?: string; mfaEnforced?: boolean }): Promise<void> {
  await api.patch(`${BASE}/tenant`, dto);
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function getActivity(limit = 50): Promise<ActivityEvent[]> {
  const res = await api.get<{ data: ActivityEvent[] }>(`${BASE}/activity?limit=${limit}`);
  return res.data;
}

// ── MFA management (TOTP) ─────────────────────────────────────────────────────

export async function setupMfa(): Promise<{ qrDataUrl: string; backupCodes: string[] }> {
  const res = await api.post<{ data: { qrDataUrl: string; backupCodes: string[] } }>(
    `${BASE}/mfa/setup`,
  );
  return res.data;
}

export async function enableMfa(code: string): Promise<void> {
  await api.post(`${BASE}/mfa/enable`, { code });
}

export async function disableMfa(code: string): Promise<void> {
  await api.post(`${BASE}/mfa/disable`, { code });
}

// ── MFA challenge/verify (called after Supabase login when mfaEnabled=true) ───

export async function requestMfaChallenge(userId: string): Promise<{ mfaToken: string }> {
  const res = await api.post<{ data: { mfaToken: string } }>(`${BASE}/mfa/challenge`, { userId });
  return res.data;
}

export async function verifyMfaChallenge(body: {
  mfaToken: string;
  code: string;
}): Promise<{ userId: string }> {
  const res = await api.post<{ data: { userId: string } }>(`${BASE}/mfa/verify`, body);
  return res.data;
}
