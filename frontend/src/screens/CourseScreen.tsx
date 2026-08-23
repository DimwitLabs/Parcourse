import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import CourseActionModal from "../components/CourseActionModal";
import type { CourseAction } from "../components/CourseActionModal";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { shownScore } from "../lib/score";
import { useEscapeKey } from "../lib/useEscapeKey";


type Attempt = { id: string; total_score: number; max_score: number };
type MCQOption = { label: string; text: string };
type MCQ = { id: string; question: string; options: MCQOption[] };
type TheoryQ = { id: string; question: string };
type Section = {
  title: string;
  summary: string;
  key_takeaways: string[];
  start_seconds: number;
  end_seconds: number;
  mcqs: MCQ[];
  theory_questions: TheoryQ[];
};
type Course = {
  id: string;
  video_id: string;
  thumbnail_url: string;
  sections: Section[];
};

export default function CourseScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [playStart, setPlayStart] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRef = useRef<HTMLDivElement>(null);

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [courseAction, setCourseAction] = useState<CourseAction | null>(null);
  const [doneSections, setDoneSections] = useState<Set<number>>(new Set());
  const [atBottom, setAtBottom] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const quizBoxRef = useRef<HTMLDivElement>(null);
  const submitBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;
    apiFetch(`/courses/${courseId}`, token)
      .then((data) => {
        if (!ignore) setCourse(data);
      })
      .catch((err) => {
        if (ignore) return;
        toast(errMsg(err), "error");
        navigate("/notebook", { replace: true });
      });
    apiFetch(`/courses/${courseId}/progress`, token)
      .then((indices: number[]) => {
        if (!ignore) setDoneSections(new Set(indices));
      })
      .catch(() => {});
    apiFetch(`/quiz/attempts/${courseId}/history`, token)
      .then((history: Attempt[]) => {
        // Newest first. Nothing to look back on before the first submission,
        // and a button that leads to an empty page is worse than no button.
        if (!ignore) setLastAttempt(history[0] ?? null);
      })
      .catch(() => {});
    apiFetch(`/courses/${courseId}/draft`, token)
      .then((draft: { mcq_answers: Record<string, string>; theory_answers: Record<string, string> }) => {
        if (ignore) return;
        if (Object.keys(draft.mcq_answers).length) setMcqAnswers(draft.mcq_answers);
        if (Object.keys(draft.theory_answers).length) setTheoryAnswers(draft.theory_answers);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [courseId, token, navigate]);

  useEffect(() => {
    if (!course) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveSection(idx);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));

    function onScroll() {
      const isAtBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
      setAtBottom(isAtBottom);
      if (isAtBottom) {
        const lastVisible = sectionRefs.current.reduce((last, el, i) => {
          if (el && el.getBoundingClientRect().top < window.innerHeight) return i;
          return last;
        }, -1);
        if (lastVisible !== -1) setActiveSection(lastVisible);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [course]);

  useEffect(() => {
    const el = submitBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setBarVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [course]);

  useEscapeKey(showSkipModal, () => {
    if (!submitting) setShowSkipModal(false);
  });

  function handleSubmitClick() {
    if (!course) return;
    const skipped = totalQuestions - answeredQuestions;
    if (skipped > 0) {
      setShowSkipModal(true);
      return;
    }
    submitQuiz();
  }

  async function submitQuiz() {
    if (!course) return;
    setShowSkipModal(false);
    setSubmitting(true);
    try {
      saveDraft();
      const result = await apiFetch("/quiz/score", token, {
        method: "POST",
        body: JSON.stringify({
          course_id: course.id,
          mcq_answers: Object.entries(mcqAnswers).map(([question_id, selected_label]) => ({
            question_id,
            selected_label,
          })),
          theory_answers: Object.entries(theoryAnswers).map(([question_id, answer_text]) => ({
            question_id,
            answer_text,
          })),
        }),
      });
      navigate(`/course/${course.id}/results`, { state: { result, course } });
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function saveDraft(mcq = mcqAnswers, theory = theoryAnswers) {
    if (!course) return;
    apiFetch(`/courses/${course.id}/draft`, token, {
      method: "PUT",
      body: JSON.stringify({ mcq_answers: mcq, theory_answers: theory }),
    }).catch((err) => {
      console.warn("[draft] save failed:", err);
    });
  }

  async function toggleSectionDone(index: number) {
    if (!course) return;
    const isDone = doneSections.has(index);
    const method = isDone ? "DELETE" : "POST";
    setDoneSections((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(index);
      else next.add(index);
      return next;
    });
    try {
      await apiFetch(`/courses/${course.id}/progress/${index}`, token, { method });
      saveDraft();
    } catch {
      setDoneSections((prev) => {
        const next = new Set(prev);
        if (isDone) next.add(index);
        else next.delete(index);
        return next;
      });
    }
  }

  if (!course) return <p className="status-message">Loading course…</p>;

  const totalQuestions = course.sections.reduce(
    (n, s) => n + s.mcqs.length + s.theory_questions.length,
    0,
  );
  const answeredQuestions = Object.keys(mcqAnswers).length + Object.keys(theoryAnswers).length;

  // Once a quiz has been graded, the answers on screen are a previous
  // submission being edited, so the button says what pressing it will do.
  const submitLabel = lastAttempt ? "Submit again" : "Submit Quiz";
  const attemptPoints = shownScore({
    total: lastAttempt?.total_score ?? 0,
    max: lastAttempt?.max_score ?? 0,
  });

  function toggleSection(idx: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function scrollToSection(idx: number) {
    if (!openSections.has(idx)) toggleSection(idx);
    setTimeout(() => {
      sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  // The sidebar is gone below 860px, so these travel with the quiz instead of
  // disappearing along with it.
  const courseActions = (
    <>
      {lastAttempt && (
      <button className="icon-btn tip" data-tip="Quiz history" aria-label="Quiz history" onClick={() => navigate(`/course/${courseId}/history`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 14"/></svg>
      </button>
      )}
      <button className="icon-btn tip" data-tip="Cheatsheet" aria-label="Cheatsheet" onClick={() => navigate(`/course/${courseId}/cheatsheet`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/></svg>
      </button>
      <button className="icon-btn tip" data-tip="Regenerate course" aria-label="Regenerate course" onClick={() => setCourseAction("regenerate")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </button>
      <button className="icon-btn danger tip" data-tip="Delete course" aria-label="Delete course" onClick={() => setCourseAction("delete")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </>
  );

  return (
    <div className="course-layout">
      <aside className="course-sidebar">
        <nav className="sidebar-nav">
          <span className="sidebar-label">Sections</span>
          <div className="sidebar-section-list">
            {course.sections.map((s, i) => (
              <button
                key={i}
                className={`sidebar-item${activeSection === i ? " active" : ""}${doneSections.has(i) ? " done" : ""}`}
                onClick={() => scrollToSection(i)}
              >
                <span className="sidebar-item-num">{doneSections.has(i) ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : i + 1}</span>
                <span className="sidebar-item-title">{s.title}</span>
              </button>
            ))}
          </div>

          <div className={`quiz-sidebar-box${barVisible ? " fading" : ""}`} ref={quizBoxRef}>
            {lastAttempt ? (
              <button className="quiz-last-attempt" onClick={() => navigate(`/course/${courseId}/results?attempt=${lastAttempt.id}`)}>
                Last attempt <b>{attemptPoints.score}/{attemptPoints.outOf}</b>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ) : (
              <div className="quiz-sidebar-count">{answeredQuestions}/{totalQuestions} answered</div>
            )}
            <button className="button primary" style={{ width: "100%" }} onClick={handleSubmitClick} disabled={submitting}>
              {submitting ? "Grading…" : submitLabel}
            </button>
          </div>

          <div className="sidebar-actions">{courseActions}</div>
        </nav>
      </aside>

      <div className="course-main">
        <div className="course-view">
          <div className="video-frame" ref={videoRef}>
            <iframe
              key={playKey}
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${course.video_id}?start=${Math.floor(playStart)}&autoplay=${playKey > 0 ? 1 : 0}`}
              title="course video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <h2 className="section-heading">Curriculum</h2>

          {course.sections.map((s, i) => {
            const isOpen = openSections.has(i);
            return (
              <div
                className={`card section-card${isOpen ? " open" : ""}`}
                key={i}
                ref={(el) => { sectionRefs.current[i] = el; }}
              >
                <button className="section-card-toggle" onClick={() => toggleSection(i)}>
                  <span className={`sidebar-item-num${doneSections.has(i) ? " done" : ""}`}>{doneSections.has(i) ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : i + 1}</span>
                  <h3 className="section-title">{s.title}</h3>
                  <span className={`toggle-chevron${isOpen ? " open" : ""}`}>▾</span>
                </button>

                {isOpen && (
                  <div className="section-card-body">
                    <button className="button secondary" onClick={() => { setPlayStart(s.start_seconds); setPlayKey((k) => k + 1); videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                      ▶ Watch this part
                    </button>

                    <div className="ai-card">
                      <div className="ai-card-eyebrow">
                        <span className="spark">✦</span> AI Summary: Key Takeaways
                      </div>
                      <div className="ai-card-grid">
                        <p className="quote">{s.summary}</p>
                        {s.key_takeaways.length > 0 && (
                          <ul className="ai-card-points">
                            {s.key_takeaways.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {s.mcqs.map((m) => (
                      <div className="question-block" key={m.id}>
                        <p className="question-text">{m.question}</p>
                        <div className="mcq-options">
                          {m.options.map((o) => (
                            <label className="mcq-option" key={o.label}>
                              <input
                                type="radio"
                                name={m.id}
                                checked={mcqAnswers[m.id] === o.label}
                                onChange={() => setMcqAnswers((prev) => ({ ...prev, [m.id]: o.label }))}
                              />
                              <span>
                                {o.label}. {o.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    {s.theory_questions.map((t) => (
                      <div className="question-block" key={t.id}>
                        <p className="question-text">{t.question}</p>
                        <textarea
                          className="text-input boxed textarea"
                          value={theoryAnswers[t.id] ?? ""}
                          onChange={(e) => setTheoryAnswers((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="Your answer…"
                        />
                      </div>
                    ))}

                    <button
                      className={`button ${doneSections.has(i) ? "secondary done" : "primary"} section-done-btn`}
                      onClick={() => toggleSectionDone(i)}
                    >
                      {doneSections.has(i) ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span className="done-label">Done</span><span className="undone-label">Undo</span></> : "Mark as done"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <Link className="attempt-row attempt-back card" to={`/course/${courseId}/cheatsheet`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/></svg>
            Open the cheatsheet
          </Link>

          <div className="submit-bar card" ref={submitBarRef}>
            {lastAttempt ? (
              <button className="quiz-last-attempt" onClick={() => navigate(`/course/${courseId}/results?attempt=${lastAttempt.id}`)}>
                Last attempt <b>{attemptPoints.score}/{attemptPoints.outOf}</b>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ) : (
              <span className="status-message">
                {answeredQuestions} / {totalQuestions} answered
              </span>
            )}
            <button className="button primary" onClick={handleSubmitClick} disabled={submitting}>
              {submitting ? "Grading…" : submitLabel}
            </button>
          </div>

          <div className="course-actions-mobile">{courseActions}</div>
        </div>
      </div>

      {showSkipModal && (
        <div className="modal-overlay" onClick={() => setShowSkipModal(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>
              Skip {totalQuestions - answeredQuestions} question{totalQuestions - answeredQuestions === 1 ? "" : "s"}?
            </h2>
            <p style={{ margin: "0 0 1.5rem", color: "var(--color-ink-soft)" }}>
              You've answered {answeredQuestions} of {totalQuestions} questions. Skipped questions will be scored as zero.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setShowSkipModal(false)}>
                Go back
              </button>
              <button className="button primary" onClick={submitQuiz}>
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <CourseActionModal
        action={courseAction}
        course={course}
        onClose={() => setCourseAction(null)}
        onDeleted={() => navigate("/notebook")}
        onError={(m) => toast(m, "error")}
      />
    </div>
  );
}
