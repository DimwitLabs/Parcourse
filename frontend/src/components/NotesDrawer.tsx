import { useState } from "react";

import { useEscapeKey } from "../lib/useEscapeKey";
import NotesSheet from "./NotesSheet";

const gripIcon = <span className="notes-tab-grip" aria-hidden="true" />;

export default function NotesDrawer({ courseId, title }: { courseId: string; title: string }) {
  const [open, setOpen] = useState(false);

  useEscapeKey(open, () => setOpen(false));

  return (
    <>
      <button
        className={`notes-tab${open ? " hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open notes"
      >
        {gripIcon}
        <span>Notes</span>
      </button>

      {open && (
        <div className="notes-overlay">
          <div className="notes-backdrop" onClick={() => setOpen(false)} />
          <aside className="notes-sheet">
            <NotesSheet courseId={courseId} title={title} live={open} onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
