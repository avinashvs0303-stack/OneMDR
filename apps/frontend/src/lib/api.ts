/**
 * Thin API client — wraps fetch with auth headers, base URL, and error handling.
 * Reads the access token from the auth store and attaches it as Bearer header.
 * On 401, attempts one silent token refresh before propagating the error.
 */

import type { ApiError } from '@onemdr/shared';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Read the stored access token without importing the full Zustand store (avoids circular deps). */
function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('onemdr-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function silentRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve));
  }
  isRefreshing = true;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      return null;
    }
    const body = (await res.json()) as { data: { accessToken: string } };
    const token = body.data.accessToken;
    // Persist new token into session storage so store picks it up
    try {
      const raw = sessionStorage.getItem('onemdr-auth');
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        if (parsed.state) {
          parsed.state['accessToken'] = token;
          sessionStorage.setItem('onemdr-auth', JSON.stringify(parsed));
        }
      }
    } catch {
      /* ignore */
    }
    refreshQueue.forEach((cb) => cb(token));
    refreshQueue = [];
    return token;
  } catch {
    refreshQueue.forEach((cb) => cb(null));
    refreshQueue = [];
    return null;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, _retry = true): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getStoredAccessToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    // Include cookies (for refresh token httpOnly cookie)
    credentials: 'include',
  });

  // Silent refresh on first 401
  if (res.status === 401 && _retry && path !== '/auth/refresh') {
    const newToken = await silentRefresh();
    if (newToken) return request<T>(path, options, false);
    // Refresh failed — clear session and redirect to login
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('onemdr-auth');
      window.location.href = '/auth/login';
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    const err = body.error;
    throw new ApiRequestError(
      err?.message ?? `Request failed: ${res.status}`,
      res.status,
      err?.code ?? 'UNKNOWN',
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: HeadersInit) => request<T>(path, { method: 'GET', headers }),

  post: <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
