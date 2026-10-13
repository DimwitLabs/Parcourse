import { useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode, SyntheticEvent } from "react";

import { dialogClosed, dialogOpened } from "../lib/topDialog";

type Props = {
  label: string;
  onClose: () => void;
  /** While true, Escape and clicks outside leave the dialog open. */
  locked?: boolean;
  className?: string;
  children: ReactNode;
};

const NATIVE_LIGHT_DISMISS = "closedBy" in HTMLDialogElement.prototype;

export default function Modal({ label, onClose, locked = false, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // A layout effect so the cleanup runs while the dialog is still attached: closing it then hands focus back.
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    dialogOpened(dialog);
    return () => {
      dialogClosed(dialog);
      dialog.close();
    };
  }, []);

  function cancel(event: SyntheticEvent) {
    event.preventDefault();
    if (!locked) onClose();
  }

  // Safari has no closedby yet: a click whose target is the dialog itself but lands outside its box hit the backdrop.
  function backdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (NATIVE_LIGHT_DISMISS || locked || event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside =
      box.top <= event.clientY && event.clientY <= box.bottom && box.left <= event.clientX && event.clientX <= box.right;
    if (!inside) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`modal-card card ${className}`.trim()}
      aria-label={label}
      closedby={locked ? "none" : "any"}
      onCancel={cancel}
      onClick={backdropClick}
    >
      {children}
    </dialog>
  );
}
