import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { applyTheme, onThemeChanged, paintTheme, storedTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";

const SUN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MOON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const AUTO = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" />
  </svg>
);

const THEMES: { key: Theme; label: string; icon: ReactElement }[] = [
  { key: "system", label: "Auto", icon: AUTO },
  { key: "light", label: "Light", icon: SUN },
  { key: "dark", label: "Dark", icon: MOON },
];

export default function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(
    () =>
      onThemeChanged((next) => {
        paintTheme(next);
        setTheme(next);
      }),
    []
  );

  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + THEMES.length) % THEMES.length;
    choose(THEMES[next].key);
    options.current[next]?.focus();
  }

  return (
    <div className={`theme-switch ${className}`.trim()} role="radiogroup" aria-label="Theme">
      {THEMES.map(({ key, label, icon }, index) => (
        <button
          key={key}
          type="button"
          ref={(el) => {
            options.current[index] = el;
          }}
          className={`theme-switch-option${theme === key ? " active" : ""}`}
          role="radio"
          aria-checked={theme === key}
          tabIndex={theme === key ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => choose(key)}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
