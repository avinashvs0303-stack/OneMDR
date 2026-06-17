/**
 * Typed wrappers around the NestJS auth endpoints.
 * All functions throw ApiRequestError on failure.
 */

import { api } from './api';

const BASE = '/auth';

// ── Response types ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  tenantId: string;
  tenantName?: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export type LoginResult =
  | { requiresMfa: false; session: AuthSession }
  | { requiresMfa: true; mfaToken: string };

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantName: string;
}): Promise<AuthSession> {
  const res = await api.post<{ data: AuthSession }>(`${BASE}/register`, body);
  return res.data;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(body: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginResult> {
  const res = await api.post<{
    data:
      | { requiresMfa: true; mfaToken: string }
      | { requiresMfa?: undefined; accessToken: string; user: AuthUser };
  }>(`${BASE}/login`, body);

  if (res.data.requiresMfa) {
    return { requiresMfa: true, mfaToken: res.data.mfaToken };
  }

  const d = res.data as { accessToken: string; user: AuthUser };
  return { requiresMfa: false, session: { accessToken: d.accessToken, user: d.user } };
}

// ── MFA login (complete challenge) ────────────────────────────────────────────

export async function verifyMfaLogin(body: {
  mfaToken: string;
  code: string;
}): Promise<AuthSession> {
  const res = await api.post<{ data: AuthSession }>(`${BASE}/mfa/verify-login`, body);
  return res.data;
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refreshTokens(): Promise<{ accessToken: string }> {
  const res = await api.post<{ data: { accessToken: string } }>(`${BASE}/refresh`);
  return res.data;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await api.post(`${BASE}/logout`);
}

// ── MFA management ────────────────────────────────────────────────────────────

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
