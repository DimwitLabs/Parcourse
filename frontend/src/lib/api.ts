import { API_BASE_URL } from "./auth";

export function errMsg(err: unknown): string {
  return String(err instanceof Error ? err.message : err);
}

export async function apiFetch(path: string, token: string | null, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
  return data;
}
