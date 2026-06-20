/**
 * Thin API client — wraps fetch with auth headers, base URL, and error handling.
 * Reads the Supabase access token and attaches it as a Bearer header for Railway.
 * On 401, attempts one silent refresh via Supabase before propagating the error.
 */

import type { ApiError } from '@onemdr/shared';
import { supabase } from './supabase';

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

/** Get the current Supabase access token for Railway API calls. */
async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}, _retry = true): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = await getAccessToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  // On 401: try refreshing the Supabase session once, then retry
  if (res.status === 401 && _retry) {
    const {
      data: { session },
    } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      return request<T>(path, options, false);
    }
    // Refresh failed — session is truly gone
    if (typeof window !== 'undefined') {
      const isAdminRoute = window.location.pathname.startsWith('/admin');
      window.location.href = isAdminRoute ? '/admin/login' : '/auth/login';
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
