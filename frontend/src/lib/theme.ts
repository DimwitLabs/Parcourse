export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "parcourse_theme";

function read(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function write(theme: Theme) {
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
  window.addEventListener("storage", listen);
  return () => window.removeEventListener("storage", listen);
}
