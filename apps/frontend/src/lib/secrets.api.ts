import { api } from './api';

const BASE = '/secrets';

export interface SharedSecretMeta {
  id: string;
  label: string | null;
  hasPassphrase: boolean;
  ttlSeconds: number;
  expiresAt: string;
  viewedAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export interface CreateSecretResult {
  id: string;
  shareUrl: string;
  expiresAt: string;
  hasPassphrase: boolean;
  label: string | null;
}

export interface PeekResult {
  label: string | null;
  hasPassphrase: boolean;
  expiresAt: string;
  burned: boolean;
  burnReason: 'viewed' | 'revoked' | 'expired' | null;
}

export interface ViewResult {
  content: string;
  label: string | null;
  creatorName: string | null;
  createdAt: string;
}

export const createSecret = (data: {
  content: string;
  label?: string;
  passphrase?: string;
  ttlSeconds?: number;
}): Promise<CreateSecretResult> => api.post(BASE, data);

export const listSecrets = (): Promise<SharedSecretMeta[]> => api.get(BASE);

export const revokeSecret = (id: string): Promise<{ revoked: boolean }> =>
  api.delete(`${BASE}/${id}`);

export const peekSecret = (token: string): Promise<PeekResult> => api.get(`${BASE}/peek/${token}`);

export const viewSecret = (token: string, passphrase?: string): Promise<ViewResult> =>
  api.post(`${BASE}/view/${token}`, { passphrase });
