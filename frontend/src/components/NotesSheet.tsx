import { useState } from "react";

import { errMsg } from "../lib/api";
import { EDITOR_PLACEHOLDER, SHEET_LOADING } from "../lib/notes";
import { exportNotes } from "../lib/notesExport";
import { useNoteSheet } from "../lib/useNoteSheet";
import NotesChip from "./NotesChip";
import NotesGuide from "./NotesGuide";
import { toast, useLoadingToast } from "./Toast";

const closeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

export default function NotesSheet({
  courseId,
  title,
  live,
  onClose,
}: {
  courseId: string;
  title: string;
  live: boolean;
  onClose: () => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);

  const { body, sheetState, saveState, saveNow, editorHost } = useNoteSheet(courseId, EDITOR_PLACEHOLDER, live);

  useLoadingToast(live && sheetState === "loading", SHEET_LOADING);

  async function exportSheet(kind: "png" | "pdf") {
    setExporting(kind);
    try {
      await exportNotes(title, body, kind);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="notes-head">
        <span className="notes-title">
          Notes
          <span className="notes-sub">{title}</span>
        </span>
        <NotesChip state={saveState} onSave={saveNow} />
        <button className="notes-icon-btn" onClick={onClose} aria-label="Close notes">
          {closeIcon}
        </button>
      </div>

      <div className="notes-body" ref={editorHost} />

      <div className={`notes-tail${guideOpen ? " open" : ""}`}>
        <NotesGuide onToggle={setGuideOpen} />
        <div className="notes-actions">
          <button className="notes-export-btn" onClick={() => exportSheet("png")} disabled={exporting !== null || body.trim() === ""}>
            {exporting === "png" ? "Drawing" : "PNG"}
          </button>
          <button className="notes-export-btn" onClick={() => exportSheet("pdf")} disabled={exporting !== null || body.trim() === ""}>
            {exporting === "pdf" ? "Building" : "PDF"}
          </button>
        </div>
      </div>
    </>
  );
}
