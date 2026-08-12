import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseEntry, Segment } from "../lib/types";

type ModalAction = { course: CourseEntry; type: "delete" | "regenerate" };

export default function NotebookScreen() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalAction | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    apiFetch("/courses", token)
      .then(setCourses)
      .catch((err) => setError(String(err.message ?? err)));
  }

  useEffect(refresh, [token]);

  async function deleteCourse(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/course/${id}`, token, { method: "DELETE" });
      setCourses((prev) => prev?.filter((c) => c.id !== id) ?? null);
      setModal(null);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCourse(c: CourseEntry) {
    setBusy(true);
    try {
      await apiFetch(`/course/${c.id}`, token, { method: "DELETE" });

      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${c.video_id}` }),
      });

      const segments: Segment[] = transcriptData.segments;
      const courseData = await apiFetch("/course/generate", token, {
        method: "POST",
        body: JSON.stringify({ video_id: c.video_id, segments }),
      });

      setModal(null);
      navigate(`/course/${courseData.id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (error) return <p className="error-message">{error}</p>;
  if (!courses) return <p className="status-message">Loading your notebook…</p>;

  if (courses.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="results-headline">Your notebook is empty</h2>
        <p className="hero-subtitle">Paste a YouTube link on the home page to generate your first course.</p>
        <Link to="/" className="button primary" style={{ display: "inline-block", marginTop: "1rem" }}>
          Get started
        </Link>
      </div>
    );
  }

  return (
    <div className="notebook-view">
      <div className="page-header">
        <h1 className="page-header-title">Notebook</h1>
        <p className="page-header-sub">All the courses you have generated so far.</p>
      </div>

      <div className="notebook-grid">
        {courses.map((c) => (
          <div key={c.id} className="notebook-card card">
            <Link to={`/course/${c.id}`} className="notebook-card-link">
              <img className="notebook-thumb" src={c.thumbnail_url} alt="" loading="lazy" />
              <div className="notebook-card-body">
                <span className="notebook-section-count">{c.sections.length} sections</span>
                <ul className="notebook-sections">
                  {c.sections.slice(0, 3).map((s, i) => (
                    <li key={i}>{s.title}</li>
                  ))}
                  {c.sections.length > 3 && <li>+{c.sections.length - 3} more</li>}
                </ul>
              </div>
            </Link>
            <div className="notebook-card-actions">
              <button className="icon-btn" onClick={() => setModal({ course: c, type: "regenerate" })} title="Regenerate course">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
              <button className="icon-btn danger" onClick={() => setModal({ course: c, type: "delete" })} title="Delete course">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => !busy && setModal(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>
              {modal.type === "delete" ? "Delete course" : "Regenerate course"}
            </h2>
            <p style={{ margin: "0 0 1.5rem", color: "var(--color-ink-soft)" }}>
              {modal.type === "delete"
                ? "This will permanently delete this course and all associated quiz data."
                : "This will delete the current course and regenerate it from scratch using the same video."}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className={`button ${modal.type === "delete" ? "danger" : "primary"}`}
                onClick={() =>
                  modal.type === "delete"
                    ? deleteCourse(modal.course.id)
                    : regenerateCourse(modal.course)
                }
                disabled={busy}
              >
                {busy
                  ? modal.type === "delete" ? "Deleting…" : "Regenerating…"
                  : modal.type === "delete" ? "Delete" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
