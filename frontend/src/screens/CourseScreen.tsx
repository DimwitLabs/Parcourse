import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import GenerationSteps, {
  FALLBACK_MESSAGES,
  REGEN_STEPS,
  useRotatingMessage,
} from "../components/GenerationSteps";
import type { RegenStep } from "../components/GenerationSteps";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useEscapeKey } from "../lib/useEscapeKey";
import type { Segment } from "../lib/types";


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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playStart, setPlayStart] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRef = useRef<HTMLDivElement>(null);

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [courseAction, setCourseAction] = useState<"delete" | "regenerate" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [cleanupGraph, setCleanupGraph] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenStep, setRegenStep] = useState<RegenStep>("");
  const regenMsg = useRotatingMessage(regenStep === "generating", FALLBACK_MESSAGES);
  const [doneSections, setDoneSections] = useState<Set<number>>(new Set());
  const [atBottom, setAtBottom] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const quizBoxRef = useRef<HTMLDivElement>(null);
  const submitBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!courseId) return;
    apiFetch(`/courses/${courseId}`, token)
      .then(setCourse)
      .catch((err) => setLoadError(String(err.message ?? err)));
    apiFetch(`/courses/${courseId}/progress`, token)
      .then((indices: number[]) => setDoneSections(new Set(indices)))
      .catch(() => {});
    apiFetch(`/courses/${courseId}/draft`, token)
      .then((draft: { mcq_answers: Record<string, string>; theory_answers: Record<string, string> }) => {
        if (Object.keys(draft.mcq_answers).length) setMcqAnswers(draft.mcq_answers);
        if (Object.keys(draft.theory_answers).length) setTheoryAnswers(draft.theory_answers);
      })
      .catch(() => {});
  }, [courseId, token]);

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

  useEffect(() => {
    if (!courseAction) setRegenFeedback("");
  }, [courseAction]);

  useEscapeKey(!!courseAction || showSkipModal, () => {
    if (actionBusy || submitting) return;
    setCourseAction(null);
    setShowSkipModal(false);
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
    setSubmitError(null);
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
      setSubmitError(errMsg(err));
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

  async function deleteCourse() {
    if (!course) return;
    setActionBusy(true);
    try {
      const qs = cleanupGraph ? "?cleanup_graph=true" : "";
      await apiFetch(`/courses/${course.id}${qs}`, token, { method: "DELETE" });
      toast("Course deleted.", "info");
      navigate("/notebook");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setActionBusy(false);
      setCourseAction(null);
      setCleanupGraph(false);
    }
  }

  async function regenerateCourse() {
    if (!course) return;
    setActionBusy(true);
    try {
      setRegenStep("clearing");
      await apiFetch(`/courses/${course.id}`, token, { method: "DELETE" });
      setRegenStep("transcript");
      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${course.video_id}` }),
      });
      const segments: Segment[] = transcriptData.segments;
      setRegenStep("generating");
      const courseData = await apiFetch("/courses/generate", token, {
        method: "POST",
        body: JSON.stringify({
          video_id: course.video_id,
          video_title: transcriptData.video_title ?? "",
          feedback: regenFeedback,
          segments,
        }),
      });
      toast("Course regenerated!", "success");
      navigate(`/course/${courseData.id}`);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setActionBusy(false);
      setRegenStep("");
      setCourseAction(null);
    }
  }

  if (loadError) return <p className="error-message">{loadError}</p>;
  if (!course) return <p className="status-message">Loading course…</p>;

  const totalQuestions = course.sections.reduce(
    (n, s) => n + s.mcqs.length + s.theory_questions.length,
    0,
  );
  const answeredQuestions = Object.keys(mcqAnswers).length + Object.keys(theoryAnswers).length;

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
            <div className="quiz-sidebar-count">{answeredQuestions}/{totalQuestions} answered</div>
            <button className="button primary" style={{ width: "100%" }} onClick={handleSubmitClick} disabled={submitting}>
              {submitting ? "Grading…" : "Submit Quiz"}
            </button>
          </div>

          <div className="sidebar-actions">
            <button className="icon-btn" onClick={() => setCourseAction("regenerate")} title="Regenerate course">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button className="icon-btn danger" onClick={() => setCourseAction("delete")} title="Delete course">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
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

          <div className="submit-bar card" ref={submitBarRef}>
            <span className="status-message">
              {answeredQuestions} / {totalQuestions} answered
            </span>
            <button className="button primary" onClick={handleSubmitClick} disabled={submitting}>
              {submitting ? "Grading…" : "Submit Quiz"}
            </button>
          </div>
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

      {courseAction && (
        <div className="modal-overlay" onClick={() => !actionBusy && setCourseAction(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>
              {courseAction === "delete" ? "Delete course" : "Regenerate course"}
            </h2>
            {!regenStep && (
              <p style={{ margin: "0 0 1rem", color: "var(--color-ink-soft)" }}>
                {courseAction === "delete"
                  ? "This will permanently delete this course and all associated quiz data."
                  : "This will delete the current course and regenerate it from scratch using the same video."}
              </p>
            )}
            {courseAction === "delete" && (
              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={cleanupGraph}
                  onChange={(e) => setCleanupGraph(e.target.checked)}
                />
                <span>Also remove knowledge graph entries from this course</span>
              </label>
            )}
            {courseAction === "regenerate" && !regenStep && (
              <label className="modal-field">
                <span className="modal-field-label">What looks wrong?</span>
                <textarea
                  className="text-input boxed textarea modal-textarea"
                  value={regenFeedback}
                  onChange={(e) => setRegenFeedback(e.target.value)}
                  placeholder="Sections were too long, the quiz missed the main argument…"
                  maxLength={1000}
                  disabled={actionBusy}
                />
                <span className="modal-field-hint">
                  Required. Your feedback feeds straight into the new course generation.
                </span>
              </label>
            )}
            {regenStep && (
              <GenerationSteps steps={REGEN_STEPS} current={regenStep} note={regenMsg} />
            )}
            {!regenStep && (
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                <button className="button secondary" onClick={() => setCourseAction(null)} disabled={actionBusy}>
                  Cancel
                </button>
                <button
                  className={`button ${courseAction === "delete" ? "danger" : "primary"}`}
                  onClick={courseAction === "delete" ? deleteCourse : regenerateCourse}
                  disabled={actionBusy || (courseAction === "regenerate" && !regenFeedback.trim())}
                >
                  {actionBusy
                    ? courseAction === "delete" ? "Deleting…" : "Regenerating…"
                    : courseAction === "delete" ? "Delete" : "Regenerate"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
