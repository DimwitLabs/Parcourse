import { useEffect, useState } from "react";

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
  setTimeout(() => clear(id), ANNOUNCEMENT_MS);
}

export function useLoadingToast(waiting: boolean, message: string) {
  useEffect(() => {
    if (!waiting) return;
    const id = raise(message, "loading");
    return () => clear(id);
  }, [waiting, message]);
}

export default function ToastContainer() {
  const [shown, setShown] = useState(notes);

  useEffect(() => {
    listeners.add(setShown);
    setShown(notes);
    return () => { listeners.delete(setShown); };
  }, []);

  if (shown.length === 0) return null;

  return (
    <div className="toast-container">
      {shown.map((note) => (
        <div key={note.id} className={`toast toast-${note.type}`}>
          {note.type === "loading" && <span className="gen-pill-spinner" />}
          {note.message}
        </div>
      ))}
    </div>
  );
}
