/**
 * Auth-related API calls to Railway (NestJS backend).
 *
 * Login, logout, registration, and password reset are now handled by Supabase Auth
 * directly from the frontend — no Railway involvement for these flows.
 *
 * This file only contains MFA management calls (TOTP setup/enable/disable) which
 * remain on Railway as they require our encrypted MFA secrets stored in the DB.
 */

import { api } from './api';

export type { AuthUser } from '@/store/auth.store';

const BASE = '/auth';

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
