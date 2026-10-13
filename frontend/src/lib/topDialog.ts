import { useSyncExternalStore } from "react";

let open: HTMLDialogElement[] = [];
const watchers = new Set<() => void>();

function changed() {
  watchers.forEach((watch) => watch());
}

export function dialogOpened(dialog: HTMLDialogElement) {
  open = [...open, dialog];
  changed();
}

export function dialogClosed(dialog: HTMLDialogElement) {
  open = open.filter((each) => each !== dialog);
  changed();
}

/** The topmost open modal dialog. A modal makes the rest of the page inert, popovers included,
 *  so anything that must stay usable while one is open has to render inside it. */
export function useTopDialog(): HTMLDialogElement | null {
  return useSyncExternalStore(
    (watch) => {
      watchers.add(watch);
      return () => watchers.delete(watch);
    },
    () => open[open.length - 1] ?? null,
  );
}
