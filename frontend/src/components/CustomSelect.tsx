import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAnchoredPanel } from "../lib/anchoredPanel";

type Option = { value: string; label: string; icon?: ReactNode; group?: string; badge?: string; tone?: "primary" | "secondary" };

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

const SEARCH_THRESHOLD = 12;

export default function CustomSelect({ value, options, onChange, disabled }: Props) {
  const { open, close, triggerProps, panelProps } = useAnchoredPanel("start");
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > SEARCH_THRESHOLD;

  useEffect(() => {
    if (open) search.current?.focus();
    else setQuery("");
  }, [open]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
    const byGroup = new Map<string, Option[]>();
    for (const option of matched) {
      const key = option.group ?? "";
      byGroup.set(key, [...(byGroup.get(key) ?? []), option]);
    }
    return [...byGroup.entries()];
  }, [options, query]);

  return (
    <div className={`custom-select${open ? " open" : ""}${disabled ? " disabled" : ""}`}>
      <button type="button" className="custom-select-trigger" disabled={disabled} {...triggerProps}>
        <span className="custom-select-value">
          {selected?.icon}
          {selected?.label ?? value}
        </span>
        <svg className="custom-select-chevron" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="custom-select-panel anchored-panel" {...panelProps}>
        {searchable && (
          <input
            ref={search}
            className="custom-select-search"
            placeholder="Search…"
            aria-label="Search"
            value={query}
            type="search"
            name="provider-search"
            autoComplete="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <ul className="custom-select-list">
          {groups.map(([group, items]) => (
            <li key={group || "ungrouped"} className="custom-select-group">
              {group && (
                <span
                  className={`custom-select-group-label is-${items[0]?.tone ?? "secondary"}`}
                >
                  {group}
                </span>
              )}
              <ul aria-label={group || undefined}>
                {items.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      aria-current={o.value === value ? "true" : undefined}
                      className={`custom-select-item${o.value === value ? " selected" : ""}`}
                      onClick={() => {
                        onChange(o.value);
                        close();
                      }}
                    >
                      {o.value === value && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {o.icon}
                      {o.label}
                      {o.badge && <span className="custom-select-badge">{o.badge}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {groups.length === 0 && <li className="custom-select-empty">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
