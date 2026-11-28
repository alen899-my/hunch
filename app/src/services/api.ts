// Base URL — configure via EXPO_PUBLIC_API_URL for production HTTPS builds
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://hunch-api-eight.vercel.app/api';
const REQUEST_TIMEOUT_MS = 20000;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

let _authToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export const setGlobalToken = (token: string | null) => {
  _authToken = token;
};

export const getGlobalToken = () => _authToken;

export const registerUnauthorizedHandler = (handler: (() => void) | null) => {
  _onUnauthorized = handler;
};

export const notifyUnauthorizedIfNeeded = (status: number, usedToken?: string | null) => {
  if (status === 401 && usedToken) {
    _onUnauthorized?.();
  }
};

interface ApiOptions {
  method?: Method;
  body?: Record<string, unknown>;
  token?: string | null;
  timeoutMs?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// Core fetch wrapper with timeout, safe JSON parsing, and 401 session invalidation hook
export async function apiRequest<T = unknown>(
  endpoint: string,
  { method = 'GET', body, token, timeoutMs = REQUEST_TIMEOUT_MS }: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const activeToken = token ?? _authToken;
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    notifyUnauthorizedIfNeeded(res.status, activeToken);

    const rawText = await res.text();
    try {
      const json = JSON.parse(rawText) as ApiResponse<T>;
      if (typeof json?.success === 'boolean') {
        return json;
      }
      return {
        success: res.ok,
        message: json?.message || (res.ok ? 'Success' : `Request failed (${res.status})`),
        data: json?.data,
      };
    } catch {
      return {
        success: false,
        message: res.ok ? 'Unexpected server response' : `Request failed (${res.status})`,
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, message: 'Request timed out. Please try again.' };
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
