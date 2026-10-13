import { useEffect, useRef } from "react";

/** Runs `onEscape` when Escape is pressed while `active` is true, for overlays that are not dialogs. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handler.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}
