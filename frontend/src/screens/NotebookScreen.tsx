import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import CourseActionModal from "../components/CourseActionModal";
import IconMenu from "../components/IconMenu";
import { useLoadingToast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseEntry } from "../lib/types";

type ModalAction = { course: CourseEntry; type: "delete" | "regenerate" };

type Sort = "newest" | "oldest" | "title" | "progress";
type Filter = "all" | "unstarted" | "started" | "done";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
  { value: "progress", label: "Furthest along" },
];

const FILTERS = [
  { value: "all", label: "All courses" },
  { value: "unstarted", label: "Not started" },
  { value: "started", label: "In progress" },
  { value: "done", label: "Finished" },
];

const sortIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 16 7 20 11 16" />
    <line x1="7" y1="20" x2="7" y2="4" />
    <line x1="11" y1="4" x2="21" y2="4" />
    <line x1="11" y1="8" x2="18" y2="8" />
    <line x1="11" y1="12" x2="15" y2="12" />
  </svg>
);

const filterIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

function titleOf(c: CourseEntry) {
  return c.video_title || c.sections[0]?.title || "Untitled course";
}

/** Every word a course carries, so a search finds it by any of its parts. */
function textOf(c: CourseEntry) {
  const parts = [titleOf(c)];
  for (const section of c.sections) {
    parts.push(section.title, section.summary ?? "", ...(section.key_takeaways ?? []));
    for (const mcq of section.mcqs ?? []) {
      parts.push(mcq.question, ...mcq.options.map((o) => o.text));
    }
    for (const theory of section.theory_questions ?? []) parts.push(theory.question);
  }
  return parts.join(" ").toLowerCase();
}

function madeAt(c: CourseEntry) {
  return c.created_at ? Date.parse(c.created_at) : 0;
}

/** How much of a course is behind you, so a half-read one sorts above a fresh one. */
function progressOf(c: CourseEntry) {
  if (c.has_passed_quiz) return 1;
  return c.sections.length > 0 ? c.completed_sections.length / c.sections.length : 0;
}

function shown(courses: CourseEntry[], query: string, filter: Filter, sort: Sort) {
  const needle = query.trim().toLowerCase();
  const matched = courses.filter((c) => {
    if (needle && !textOf(c).includes(needle)) return false;
    const done = progressOf(c);
    if (filter === "unstarted") return done === 0;
    if (filter === "started") return done > 0 && done < 1;
    if (filter === "done") return done === 1;
    return true;
  });

  const order: Record<Sort, (a: CourseEntry, b: CourseEntry) => number> = {
    newest: (a, b) => madeAt(b) - madeAt(a),
    oldest: (a, b) => madeAt(a) - madeAt(b),
    title: (a, b) => titleOf(a).localeCompare(titleOf(b)),
    progress: (a, b) => progressOf(b) - progressOf(a),
  };
  return [...matched].sort(order[sort]);
}

export default function NotebookScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalAction | null>(null);
  const [togglingDone, setTogglingDone] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [filter, setFilter] = useState<Filter>("all");

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

  useLoadingToast(!courses, "Loading your notebook…");

  const visible = shown(courses ?? [], query, filter, sort);

  if (error) return <p className="error-message" style={{ padding: "2rem" }}>{error}</p>;

  return (
    <div className="notebook-view">
      <div className="notebook-header">
        <h1 className="page-header-title">Notebook</h1>
        <p className="page-header-sub">All the courses you have generated so far.</p>
        {courses && courses.length > 0 && (
          <div className="notebook-header-tools">
            <IconMenu
              icon={sortIcon}
              label="Sort"
              value={sort}
              options={SORTS}
              active={sort !== "newest"}
              onChange={(v) => setSort(v as Sort)}
            />
            <IconMenu
              icon={filterIcon}
              label="Filter"
              value={filter}
              options={FILTERS}
              active={filter !== "all"}
              onChange={(v) => setFilter(v as Filter)}
            />
          </div>
        )}
      </div>

      {!courses ? null : courses.length === 0 ? (
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

      {courses && courses.length > 0 && (
        <label className="notebook-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="text-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your courses"
            aria-label="Search your courses"
          />
        </label>
      )}

      {courses && courses.length > 0 && <hr className="notebook-rule" />}

      {courses && courses.length > 0 && visible.length === 0 && (
        <p className="status-message">Nothing here matches that. Try another search or filter.</p>
      )}

      {courses && courses.length > 0 && <div className="notebook-grid">
        {visible.map((c) => {
          const progress = c.completed_sections?.length ?? 0;
          const total = c.sections.length;
          const allSectionsDone = c.completed_sections.length === total && total > 0;
          const isComplete = c.has_passed_quiz || allSectionsDone;
          const isToggling = togglingDone.has(c.id);

          const doneHint = c.has_passed_quiz
            ? "Mastered"
            : allSectionsDone
              ? "Mark as not done"
              : "Mark all as done";
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
                <h4 className="notebook-card-title">{c.video_title || c.sections[0]?.title || "Untitled course"}</h4>
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
                className={`icon-btn done-toggle tip${allSectionsDone ? " done" : ""}`}
                data-tip={doneHint}
                aria-label={doneHint}
                onClick={() => !isToggling && toggleCourseDone(c)}
                disabled={isToggling || c.has_passed_quiz}
              >
                {allSectionsDone ? (
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" fill="var(--color-primary)" />
                    <polyline points="7,12 10.5,15.5 17,8.5" stroke="var(--color-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                ) : (
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
              {c.has_attempts && (
                <button className="icon-btn tip" data-tip="Quiz history" aria-label="Quiz history" onClick={() => navigate(`/course/${c.id}/history`)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 14"/></svg>
                </button>
              )}
              <button
                className={`icon-btn tip${c.cheatsheet_status === "pending" ? " waiting" : ""}`}
                data-tip={c.cheatsheet_status === "ready" ? "Cheatsheet" : c.cheatsheet_status === "pending" ? "Cheatsheet is being written" : "Cheatsheet could not be written"}
                aria-label="Cheatsheet"
                onClick={() => navigate(`/course/${c.id}/cheatsheet`)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/></svg>
              </button>
              <button className="icon-btn tip" data-tip="Regenerate course" aria-label="Regenerate course" onClick={() => setModal({ course: c, type: "regenerate" })}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
              <button className="icon-btn danger tip" data-tip="Delete course" aria-label="Delete course" onClick={() => setModal({ course: c, type: "delete" })}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          );
        })}
      </div>}

      <CourseActionModal
        action={modal?.type ?? null}
        course={modal?.course ?? null}
        onClose={() => setModal(null)}
        onDeleted={refresh}
        onError={setError}
      />
    </div>
  );
}
