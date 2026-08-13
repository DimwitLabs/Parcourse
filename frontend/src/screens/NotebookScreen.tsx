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
  const [cleanupGraph, setCleanupGraph] = useState(false);
  const [togglingDone, setTogglingDone] = useState<Set<string>>(new Set());

  function refresh() {
    apiFetch("/courses", token)
      .then(setCourses)
      .catch((err) => setError(String(err.message ?? err)));
  }

  useEffect(refresh, [token]);

  async function toggleCourseDone(c: CourseEntry) {
    const allSectionsDone = c.completed_sections.length === c.sections.length && c.sections.length > 0;
    setTogglingDone((prev) => new Set([...prev, c.id]));
    try {
      if (allSectionsDone) {
        await Promise.all(
          c.sections.map((_, i) =>
            apiFetch(`/courses/${c.id}/progress/${i}`, token, { method: "DELETE" })
          )
        );
      } else {
        await Promise.all(
          c.sections.map((_, i) =>
            apiFetch(`/courses/${c.id}/progress/${i}`, token, { method: "POST" })
          )
        );
      }
      refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setTogglingDone((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
    }
  }

  async function deleteCourse(id: string) {
    setBusy(true);
    try {
      const qs = cleanupGraph ? "?cleanup_graph=true" : "";
      await apiFetch(`/courses/${id}${qs}`, token, { method: "DELETE" });
      setCourses((prev) => prev?.filter((c) => c.id !== id) ?? null);
      setModal(null);
      setCleanupGraph(false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCourse(c: CourseEntry) {
    setBusy(true);
    try {
      await apiFetch(`/courses/${c.id}`, token, { method: "DELETE" });

      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${c.video_id}` }),
      });

      const segments: Segment[] = transcriptData.segments;
      const courseData = await apiFetch("/courses/generate", token, {
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

  if (error) return <p className="error-message" style={{ padding: "2rem" }}>{error}</p>;

  return (
    <div className="notebook-view">
      <div className="page-header">
        <h1 className="page-header-title">Notebook</h1>
        <p className="page-header-sub">All the courses you have generated so far.</p>
      </div>

      {!courses ? (
        <p className="status-message">Loading your notebook…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="9" y1="7" x2="15" y2="7" />
              <line x1="9" y1="11" x2="13" y2="11" />
            </svg>
          </div>
          <h2 className="empty-state-title">Your notebook is empty</h2>
          <p className="empty-state-body">Paste a YouTube link on the home page to generate your first course.</p>
          <Link to="/" className="button primary" style={{ display: "inline-block", marginTop: "1.5rem", textDecoration: "none" }}>
            Get started
          </Link>
        </div>
      ) : null}

      {courses && courses.length > 0 && <div className="notebook-grid">
        {courses.map((c) => {
          const progress = c.completed_sections?.length ?? 0;
          const total = c.sections.length;
          const allSectionsDone = c.completed_sections.length === total && total > 0;
          const isComplete = c.has_passed_quiz || allSectionsDone;
          const isToggling = togglingDone.has(c.id);
          return (
          <div key={c.id} className={`notebook-card card${isComplete ? " completed" : ""}`}>
            <Link to={`/course/${c.id}`} className="notebook-card-link">
              <div className="notebook-thumb-wrap">
                <img className="notebook-thumb" src={c.thumbnail_url} alt="" loading="lazy" />
              </div>
              {!isComplete && total > 0 && (
                <div className="notebook-progress-bar">
                  <div className="notebook-progress-fill" style={{ width: `${(progress / total) * 100}%` }} />
                </div>
              )}
              <div className="notebook-card-body">
                <h4 className="notebook-card-title">{c.sections[0]?.title ?? "Untitled course"}</h4>
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
              <button
                className={`icon-btn done-toggle${allSectionsDone ? " done" : ""}`}
                onClick={() => !isToggling && toggleCourseDone(c)}
                disabled={isToggling || c.has_passed_quiz}
                title={allSectionsDone ? "Mark as not done" : "Mark all as done"}
              >
                {allSectionsDone ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" fill="var(--color-primary)" />
                    <polyline points="7,12 10.5,15.5 17,8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
              <button className="icon-btn" onClick={() => setModal({ course: c, type: "regenerate" })} title="Regenerate course">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
              <button className="icon-btn danger" onClick={() => setModal({ course: c, type: "delete" })} title="Delete course">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          );
        })}
      </div>}

      {modal && (
        <div className="modal-overlay" onClick={() => !busy && setModal(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>
              {modal.type === "delete" ? "Delete course" : "Regenerate course"}
            </h2>
            <p style={{ margin: "0 0 1rem", color: "var(--color-ink-soft)" }}>
              {modal.type === "delete"
                ? "This will permanently delete this course and all associated quiz data."
                : "This will delete the current course and regenerate it from scratch using the same video."}
            </p>
            {modal.type === "delete" && (
              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={cleanupGraph}
                  onChange={(e) => setCleanupGraph(e.target.checked)}
                />
                <span>Also remove knowledge graph entries from this course</span>
              </label>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
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
