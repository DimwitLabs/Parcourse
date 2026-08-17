/** Gravatar URL for an email. Uses d=404 so a missing avatar fails and callers
 *  can fall back to initials. */
export async function gravatarUrl(email: string, size = 72): Promise<string> {
  const clean = email.trim().toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clean));
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=${size}`;
}

export type NamedUser = { email: string; first_name?: string | null; last_name?: string | null };

export function userInitials(user?: NamedUser | null): string {
  if (!user) return "";
  if (user.first_name) return (user.first_name[0] + (user.last_name?.[0] ?? "")).toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}
