import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

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

  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quizBarSticky, setQuizBarSticky] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const quizBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!courseId) return;
    apiFetch(`/course/${courseId}`, token)
      .then(setCourse)
      .catch((err) => setLoadError(String(err.message ?? err)));
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
    return () => observer.disconnect();
  }, [course]);

  useEffect(() => {
    const el = quizBoxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setQuizBarSticky(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [course]);

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
                className={`sidebar-item${activeSection === i ? " active" : ""}`}
                onClick={() => scrollToSection(i)}
              >
                <span className="sidebar-item-num">{i + 1}</span>
                <span className="sidebar-item-title">{s.title}</span>
              </button>
            ))}
          </div>

          <div className="quiz-sidebar-box" ref={quizBoxRef}>
            <span className="quiz-sidebar-count">{answeredQuestions} / {totalQuestions} answered</span>
            <button className="button primary" onClick={handleSubmitClick} disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
              {submitting ? "Grading…" : "Submit Quiz"}
            </button>
          </div>
        </nav>
      </aside>

      <div className="course-main">
        <div className="course-view">
          <div className="video-frame">
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
                  <span className="sidebar-item-num">{i + 1}</span>
                  <h3 className="section-title">{s.title}</h3>
                  <span className={`toggle-chevron${isOpen ? " open" : ""}`}>▾</span>
                </button>

                {isOpen && (
                  <div className="section-card-body">
                    <button className="button secondary" onClick={() => { setPlayStart(s.start_seconds); setPlayKey((k) => k + 1); }}>
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
                  </div>
                )}
              </div>
            );
          })}

          {quizBarSticky && (
            <div className="submit-bar">
              <span className="status-message">
                {answeredQuestions} / {totalQuestions} answered
              </span>
              <button className="button primary" onClick={handleSubmitClick} disabled={submitting}>
                {submitting ? "Grading…" : "Submit Quiz"}
              </button>
            </div>
          )}
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
    </div>
  );
}
