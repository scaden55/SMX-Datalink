const apiBase = '';

async function getAccessToken(): Promise<string | null> {
  const raw = localStorage.getItem('admin-auth');
  if (!raw) return null;
  try { return JSON.parse(raw).accessToken ?? null; } catch { return null; }
}

async function getRefreshToken(): Promise<string | null> {
  const raw = localStorage.getItem('admin-auth');
  if (!raw) return null;
  try { return JSON.parse(raw).refreshToken ?? null; } catch { return null; }
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    const raw = localStorage.getItem('admin-auth');
    if (raw) {
      const state = JSON.parse(raw);
      state.accessToken = data.accessToken;
      state.refreshToken = data.refreshToken;
      localStorage.setItem('admin-auth', JSON.stringify(state));
    }
    return data.accessToken;
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(`${apiBase}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const newToken = await attemptRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${apiBase}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data.message ?? res.statusText);
  }

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
