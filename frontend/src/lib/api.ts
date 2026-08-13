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
  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return null;
  }
  const data = JSON.parse(text);
  if (!res.ok) {
    const detail = data.detail;
    const msg = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(", ")
        : JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}
