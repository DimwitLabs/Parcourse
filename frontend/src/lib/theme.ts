export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "parcourse_theme";

function sharedDomain(): string {
  return window.__PARCOURSE_CONFIG__?.themeDomain ?? "";
}

function readCookie(): string | null {
  const pair = document.cookie.split("; ").find((entry) => entry.startsWith(`${THEME_KEY}=`));
  return pair === undefined ? null : pair.slice(THEME_KEY.length + 1);
}

function writeCookie(theme: Theme) {
  const age = theme === "system" ? 0 : 31536000;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_KEY}=${theme}; Domain=${sharedDomain()}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`;
}

function read(): string | null {
  if (sharedDomain() !== "") return readCookie();
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function write(theme: Theme) {
  if (sharedDomain() !== "") return writeCookie(theme);
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

export function asTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

export function storedTheme(): Theme {
  return asTheme(read());
}

export function paintTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function applyTheme(theme: Theme) {
  paintTheme(theme);
  write(theme);
}

export function onThemeChanged(handle: (theme: Theme) => void): () => void {
  const listen = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    handle(storedTheme());
  };
  const recheck = () => handle(storedTheme());
  window.addEventListener("storage", listen);
  window.addEventListener("pageshow", recheck);
  document.addEventListener("visibilitychange", recheck);
  return () => {
    window.removeEventListener("storage", listen);
    window.removeEventListener("pageshow", recheck);
    document.removeEventListener("visibilitychange", recheck);
  };
}
