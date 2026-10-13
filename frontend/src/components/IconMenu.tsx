import type { ReactNode } from "react";

import { useAnchoredPanel } from "../lib/anchoredPanel";

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
  const { open, close, triggerProps, panelProps } = useAnchoredPanel("end");

  return (
    <div className={`icon-menu${open ? " open" : ""}`}>
      <button
        type="button"
        className={`icon-btn tip${active ? " active" : ""}`}
        data-tip={label}
        aria-label={label}
        {...triggerProps}
      >
        {icon}
      </button>
      <div className="icon-menu-panel anchored-panel" role="group" aria-label={label} {...panelProps}>
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
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
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
