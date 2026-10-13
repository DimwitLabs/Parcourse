import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTopDialog } from "../lib/topDialog";

type ToastType = "success" | "error" | "info" | "loading";

type Note = { id: number; message: string; type: ToastType };

const ANNOUNCEMENT_MS = 3500;

let notes: Note[] = [];
let nextId = 0;
const listeners = new Set<(notes: Note[]) => void>();

function raise(message: string, type: ToastType) {
  const id = nextId++;
  notes = [...notes, { id, message, type }];
  listeners.forEach((listen) => listen(notes));
  return id;
}

function clear(id: number) {
  notes = notes.filter((note) => note.id !== id);
  listeners.forEach((listen) => listen(notes));
}

export function toast(message: string, type: ToastType = "info") {
  const id = raise(message, type);
  if (type !== "error") setTimeout(() => clear(id), ANNOUNCEMENT_MS);
}

export function useLoadingToast(waiting: boolean, message: string) {
  useEffect(() => {
    if (!waiting) return;
    const id = raise(message, "loading");
    return () => clear(id);
  }, [waiting, message]);
}

function Note({ note }: { note: Note }) {
  return (
    <div className={`toast toast-${note.type}`}>
      {note.type === "loading" && <span className="gen-pill-spinner" />}
      {note.message}
      {note.type === "error" && (
        <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => clear(note.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const [shown, setShown] = useState(notes);
  const region = useRef<HTMLDivElement>(null);
  const host = useTopDialog();

  useEffect(() => {
    listeners.add(setShown);
    setShown(notes);
    return () => { listeners.delete(setShown); };
  }, []);

  // Showing it again lifts the region to the top of the top layer, above anything opened since.
  useEffect(() => {
    const element = region.current;
    if (element === null || shown.length === 0) return;
    element.hidePopover();
    element.showPopover();
  }, [shown, host]);

  // The live regions stay mounted while empty so the first message is announced too.
  return createPortal(
    <div ref={region} className="toast-container" popover="manual">
      <div className="toast-stack" role="status">
        {shown.filter((note) => note.type !== "error").map((note) => <Note key={note.id} note={note} />)}
      </div>
      <div className="toast-stack" role="alert">
        {shown.filter((note) => note.type === "error").map((note) => <Note key={note.id} note={note} />)}
      </div>
    </div>,
    host ?? document.body,
  );
}
