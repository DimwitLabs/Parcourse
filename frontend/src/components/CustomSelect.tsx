import { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string; group?: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

const SEARCH_THRESHOLD = 12;

export default function CustomSelect({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > SEARCH_THRESHOLD;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
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
    <div className={`custom-select${open ? " open" : ""}${disabled ? " disabled" : ""}`} ref={ref}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? value}</span>
        <svg className="custom-select-chevron" width="12" height="7" viewBox="0 0 12 7" fill="none">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="custom-select-panel">
          {searchable && (
            <input
              className="custom-select-search"
              placeholder="Search…"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <ul className="custom-select-list" role="listbox">
            {groups.map(([group, items]) => (
              <li key={group || "ungrouped"} className="custom-select-group">
                {group && <span className="custom-select-group-label">{group}</span>}
                <ul>
                  {items.map((o) => (
                    <li
                      key={o.value}
                      role="option"
                      aria-selected={o.value === value}
                      className={`custom-select-item${o.value === value ? " selected" : ""}`}
                      onClick={() => { onChange(o.value); setOpen(false); }}
                    >
                      {o.value === value && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {o.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {groups.length === 0 && <li className="custom-select-empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
