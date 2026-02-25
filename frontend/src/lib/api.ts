import { useAuthStore } from '../stores/authStore';
import type { RefreshResponse } from '@acars/shared';

// Packaged Electron exe: connect to the central VPS server
// Dev Electron: connect to local backend on localhost:3001
// Dev browser: relative paths work via Vite proxy
const PRODUCTION_SERVER = 'http://138.197.127.39:3001';
const DEV_BACKEND = 'http://localhost:3001';

let apiBase = '';

const apiBaseReady: Promise<void> = (async () => {
  if (window.electronAPI) {
    // file:// protocol = packaged exe → use central server
    // http:// protocol = dev mode (Vite) → use local backend
    const isPackaged = window.location.protocol === 'file:';
    apiBase = import.meta.env.VITE_API_BASE || (isPackaged ? PRODUCTION_SERVER : DEV_BACKEND);
  }
  // Browser dev mode: apiBase stays '' (Vite proxy handles /api)
})();

export function getApiBase(): string {
  return apiBase;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Mutex: concurrent 401s share one refresh promise
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
  if (!refreshToken) {
    clearAuth();
    return false;
  }

  try {
    const res = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearAuth();
      return false;
    }

    const data: RefreshResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  await apiBaseReady;
  const fullUrl = `${apiBase}${url}`;
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 → attempt token refresh, retry once
  if (res.status === 401 && accessToken) {
    if (!refreshPromise) {
      refreshPromise = attemptRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      const { accessToken: newToken } = useAuthStore.getState();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(fullUrl, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } else {
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
      message = text || res.statusText;
    }
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T>(url: string, body?: unknown) => request<T>('DELETE', url, body),
};
