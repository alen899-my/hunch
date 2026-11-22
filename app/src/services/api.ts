// Base URL — change to your machine IP when testing on a physical device
// e.g. http://192.168.1.x:3000/api  (not localhost on real devices)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

let _authToken: string | null = null;

export const setGlobalToken = (token: string | null) => {
  _authToken = token;
};

export const getGlobalToken = () => _authToken;

interface ApiOptions {
  method?: Method;
  body?: Record<string, unknown>;
  token?: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// Core fetch wrapper — returns typed ApiResponse or throws
export async function apiRequest<T = unknown>(
  endpoint: string,
  { method = 'GET', body, token }: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Use explicit token or fallback to globally stored token
  const activeToken = token ?? _authToken;
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json: ApiResponse<T> = await res.json();
  return json;
}
