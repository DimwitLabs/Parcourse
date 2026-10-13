import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ToggleEvent } from "react";

const ANCHORS = typeof CSS !== "undefined" && CSS.supports("anchor-name: --a");

/** Wires a trigger to a popover panel: the browser handles Escape, outside clicks and the top layer,
 *  and CSS anchor positioning keeps the panel at its trigger. Browsers without anchor positioning get
 *  fixed coordinates instead, and the panel closes when the page scrolls out from under it. */
export function useAnchoredPanel(align: "start" | "end") {
  const id = useId();
  const anchor = `--anchor${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ANCHORS || !open) return;
    const box = panel.current;
    const button = trigger.current;
    if (box === null || button === null) return;

    const edge = button.getBoundingClientRect();
    box.classList.add("is-placed");
    box.style.setProperty("position-area", "none");
    box.style.top = `${edge.bottom + 6}px`;
    box.style.minWidth = `${edge.width}px`;
    if (align === "start") box.style.left = `${edge.left}px`;
    else box.style.right = `${window.innerWidth - edge.right}px`;

    const drift = (event: Event) => {
      if (!box.contains(event.target as Node)) box.hidePopover();
    };
    window.addEventListener("scroll", drift, { capture: true, passive: true });
    window.addEventListener("resize", drift);
    return () => {
      window.removeEventListener("scroll", drift, { capture: true });
      window.removeEventListener("resize", drift);
    };
  }, [open, align]);

  return {
    open,
    close: () => panel.current?.hidePopover(),
    triggerProps: {
      ref: trigger,
      popoverTarget: id,
      "aria-expanded": open,
      style: ANCHORS ? ({ anchorName: anchor } as CSSProperties) : undefined,
    },
    panelProps: {
      ref: panel,
      id,
      popover: "auto" as const,
      onToggle: (event: ToggleEvent<HTMLDivElement>) => setOpen(event.newState === "open"),
      style: ANCHORS ? ({ positionAnchor: anchor } as CSSProperties) : undefined,
    },
  };
}
