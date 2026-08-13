import { API_BASE_URL } from "./auth";

export function errMsg(err: unknown): string {
  return String(err instanceof Error ? err.message : err);
}

/** Turns one FastAPI validation entry into something worth showing a person.
 *  Pydantic sends e.g. {loc:["body","email"], msg:"value is not a valid email
 *  address: An email address must have an @-sign."} */
function validationMessage(d: { loc?: (string | number)[]; msg?: string }): string {
  if (!d.msg) return JSON.stringify(d);
  const field = d.loc?.filter((p) => typeof p === "string" && p !== "body").pop();
  const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const text = d.msg.replace(/^Value error,\s*/i, "").split(": ")[0];
  const label = typeof field === "string" ? field.replace(/_/g, " ") : "";
  if (!label) return capitalise(text);
  if (/^field required$/i.test(text)) return capitalise(`${label} is required`);
  return capitalise(`${label} ${text.replace(/^(String|Input|Value)\s+/i, "")}`);
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
        ? detail.map(validationMessage).join(", ")
        : JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}
