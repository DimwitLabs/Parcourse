import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Option = { value: string; label: string };

type Props = {
  icon: ReactNode;
  label: string;
  value: string;
  options: Option[];
  active?: boolean;
  onChange: (value: string) => void;
};

export default function IconMenu({ icon, label, value, options, active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className={`icon-menu${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className={`icon-btn tip${active ? " active" : ""}`}
        data-tip={label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
      </button>
      {open && (
        <ul className="icon-menu-panel" role="listbox" aria-label={label}>
          {options.map((o) => (
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
      )}
    </div>
  );
}
