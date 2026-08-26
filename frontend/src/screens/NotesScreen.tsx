import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { toast, useLoadingToast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { readNote } from "../lib/notes";

type Sheet = { title: string; body: string; html: string };

export default function NotesScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [saving, setSaving] = useState<"pdf" | "png" | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;

    Promise.all([
      apiFetch(`/courses/${courseId}`, token),
      readNote(courseId, token),
      import("../lib/markdown"),
    ])
      .then(([course, note, { markdownToHtml }]) => {
        if (ignore) return;
        setSheet({
          title: course.video_title || "Untitled course",
          body: note.body,
          html: markdownToHtml(note.body),
        });
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

  useLoadingToast(!sheet, "Loading your notes…");

  async function save(kind: "pdf" | "png") {
    if (!sheet || sheet.body.trim() === "" || saving) return;
    setSaving(kind);
    try {
      const { notesFileName, notesSource } = await import("../lib/notesMarkup");
      const source = notesSource(sheet.title, sheet.body);
      const name = notesFileName(sheet.title, kind);
      if (kind === "pdf") {
        const { sheetPdf } = await import("../lib/sheetPdf");
        await sheetPdf(source, name);
      } else {
        const { sheetPng } = await import("../lib/sheetImage");
        await sheetPng(source, name);
      }
    } catch {
      toast(`Couldn't build the ${kind.toUpperCase()}. Try again.`, "error");
    } finally {
      setSaving(null);
    }
  }

  if (!sheet) return null;

  const written = sheet.body.trim() !== "";

  return (
    <div className="cheatsheet-view">
      <div className="page-header cheatsheet-head">
        <div className="cheatsheet-head-text">
          <h1 className="page-header-title">Notes</h1>
          <p className="page-header-sub">{sheet.title}</p>
        </div>
        <div className="cheatsheet-actions">
          <button className="button secondary" onClick={() => save("png")} disabled={!written || saving !== null}>
            {saving === "png" ? "Drawing…" : "PNG"}
          </button>
          <button className="button secondary" onClick={() => save("pdf")} disabled={!written || saving !== null}>
            {saving === "pdf" ? "Building…" : "PDF"}
          </button>
        </div>
      </div>

      {written ? (
        <div className="notes-page" dangerouslySetInnerHTML={{ __html: sheet.html }} />
      ) : (
        <div className="card cheatsheet-waiting">
          <div>
            <h2 className="cheatsheet-waiting-title">Nothing written yet</h2>
            <p className="cheatsheet-waiting-body">
              Open the notes tab on the course and anything you write there shows up here.
            </p>
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
