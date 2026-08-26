import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import NotesChip from "../components/NotesChip";
import NotesGuide from "../components/NotesGuide";
import { toast, useLoadingToast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PLACEHOLDERS } from "../lib/notes";
import { exportNotes } from "../lib/notesExport";
import { useNoteSheet } from "../lib/useNoteSheet";

export default function NotesScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState<"pdf" | "png" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const { body, sheetState, saveState, saveNow, editorHost } = useNoteSheet(
    courseId ?? "",
    PLACEHOLDERS.ready,
    !!courseId,
  );

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;

    apiFetch(`/courses/${courseId}`, token)
      .then((course) => {
        if (!ignore) setTitle(course.video_title || "Untitled course");
      })
      .catch((err) => {
        if (ignore) return;
        toast(errMsg(err), "error");
        navigate(`/course/${courseId}`, { replace: true });
      });

    return () => {
      ignore = true;
    };
  }, [courseId, token, navigate]);

  useLoadingToast(!title, "Loading your notes…");

  async function save(kind: "pdf" | "png") {
    if (!title || body.trim() === "" || saving) return;
    setSaving(kind);
    try {
      await exportNotes(title, body, kind);
    } catch {
      toast(`Couldn't build the ${kind.toUpperCase()}. Try again.`, "error");
    } finally {
      setSaving(null);
    }
  }

  const written = body.trim() !== "";

  return (
    <div className="cheatsheet-view">
      <div className="page-header cheatsheet-head">
        <div className="cheatsheet-head-text">
          <h1 className="page-header-title">Notes</h1>
          <p className="page-header-sub">{title ?? "Anything worth keeping from this course."}</p>
        </div>
        <div className="cheatsheet-actions">
          <button className="button secondary" onClick={() => save("png")} disabled={!written || saving !== null}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            {saving === "png" ? "Drawing…" : "PNG"}
          </button>
          <button className="button secondary" onClick={() => save("pdf")} disabled={!written || saving !== null}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {saving === "pdf" ? "Building…" : "PDF"}
          </button>
        </div>
      </div>

      {sheetState === "ready" ? (
        <div className="card cheatsheet-sheet notes-page-card">
          <div className="notes-editor-page" ref={editorHost} />
          <div className={`notes-page-tail${guideOpen ? " open" : ""}`}>
            <NotesGuide onToggle={setGuideOpen} />
            <NotesChip state={saveState} onSave={saveNow} />
          </div>
        </div>
      ) : (
        <div className="card cheatsheet-waiting">
          <div>
            <h2 className="cheatsheet-waiting-title">
              {sheetState === "failed" ? "That didn't work" : "Fetching your notes"}
            </h2>
            <p className="cheatsheet-waiting-body">{PLACEHOLDERS[sheetState]}</p>
          </div>
        </div>
      )}

      <Link className="attempt-row attempt-back card" to={`/course/${courseId}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to the course
      </Link>
    </div>
  );
}
