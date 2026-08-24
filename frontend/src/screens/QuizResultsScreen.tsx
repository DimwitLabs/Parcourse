import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { toast, useLoadingToast } from "../components/Toast";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CHEATSHEET_HINT } from "../lib/cheatsheet";
import { download } from "../lib/download";
import type { SheetStatus } from "../lib/cheatsheet";
import { MASTERY_PCT, shownScore } from "../lib/score";
import { drawResultCard } from "../lib/shareCard";
import type { SummaryRow } from "../lib/shareCard";

type Breakdown = { accuracy: number; completeness: number; relevance: number; feedback: string };
type QuestionResult = {
  question_id: string;
  question_type: "mcq" | "theory";
  is_correct: boolean | null;
  score: number;
  max_score: number;
  feedback: string;
  breakdown: Breakdown | null;
};
type QuizResult = {
  total_score: number;
  max_score: number;
  percentage: number;
  results: QuestionResult[];
  prose_analysis?: string;
};
type MCQOption = { label: string; text: string };
type Course = {
  id: string;
  video_title?: string;
  sections: {
    mcqs: { id: string; question: string; options: MCQOption[] }[];
    theory_questions: { id: string; question: string }[];
  }[];
};

function headline(pct: number): string {
  if (pct >= MASTERY_PCT) return "Outstanding work!";
  if (pct >= 70) return "Great job! You've mastered the basics.";
  if (pct >= 40) return "Good start, some gaps remain.";
  return "Let's revisit the fundamentals.";
}

function subtitle(pct: number): string {
  if (pct >= MASTERY_PCT) return "You have a deep understanding of the material. Keep pushing forward!";
  if (pct >= 70) return "You have a strong grasp of the core concepts. A few more sessions and you'll be an expert!";
  if (pct >= 40) return "You're getting there. Review the sections you found tricky and try again.";
  return "Don't worry, re-watch the course sections and give it another shot.";
}

type Counts = {
  pct: number;
  mcqTotal: number;
  correctMcq: number;
  incorrectMcq: number;
  strongTheory: number;
  weakTheory: number;
  skipped: number;
};

// One source for the summary, so the page and the card it is shared as cannot
// drift apart.
function countsOf(result: QuizResult, pct: number): Counts {
  const skipped = (r: QuestionResult) => r.feedback === "Question was skipped.";
  const mcqs = result.results.filter((r) => r.question_type === "mcq");
  const theory = result.results.filter((r) => r.question_type === "theory");
  return {
    pct,
    mcqTotal: mcqs.length,
    correctMcq: mcqs.filter((r) => r.is_correct).length,
    incorrectMcq: mcqs.filter((r) => !r.is_correct && !skipped(r)).length,
    strongTheory: theory.filter((r) => r.score >= 4).length,
    weakTheory: theory.filter((r) => r.score < 3 && !skipped(r)).length,
    skipped: result.results.filter(skipped).length,
  };
}

function summaryRows(n: Counts): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (n.correctMcq > 0) rows.push({ tone: "good", text: `Answered ${n.correctMcq} of ${n.mcqTotal} MCQs correctly.` });
  if (n.strongTheory > 0) rows.push({ tone: "good", text: `Strong depth on ${n.strongTheory} theory ${n.strongTheory === 1 ? "question" : "questions"}.` });
  if (n.pct >= 70) rows.push({ tone: "good", text: "Solid overall grasp of the material." });
  if (n.incorrectMcq > 0) rows.push({ tone: "warn", text: `Review the ${n.incorrectMcq} missed MCQ${n.incorrectMcq === 1 ? "" : "s"}.` });
  if (n.weakTheory > 0) rows.push({ tone: "warn", text: `Deepen understanding on ${n.weakTheory} theory response${n.weakTheory === 1 ? "" : "s"}.` });
  if (n.skipped > 0) rows.push({ tone: "warn", text: `You skipped ${n.skipped} question${n.skipped === 1 ? "" : "s"}. Try answering ${n.skipped === 1 ? "it" : "them"} on your next attempt.` });
  if (n.pct < 70) rows.push({ tone: "warn", text: "Re-watch sections you found tricky before retaking." });
  return rows;
}

const RING_R = 48;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
// Material holds the track back from the active arc rather than running it
// underneath, so both ends stay visible as rounded caps.
const RING_GAP = RING_R * 0.14;

function trackLength(filled: number): number {
  if (filled <= 0) return CIRCUMFERENCE;
  return Math.max(0, CIRCUMFERENCE - filled - RING_GAP * 2);
}

const SWEEP_MS = 1100;
// The tick has finished drawing by now, which is the moment the news lands.
const TICK_MS = 620;

export default function QuizResultsScreen() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [params] = useSearchParams();
  const attemptId = params.get("attempt");
  const [data, setData] = useState<{ result: QuizResult; course: Course } | null>(
    // An attempt asked for by name is never the one just submitted, so the
    // state left behind by the submit is not what should be shown.
    attemptId ? null : ((location.state as { result: QuizResult; course: Course } | undefined) ?? null),
  );
  const [notFound, setNotFound] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<SheetStatus>("pending");

  useEffect(() => {
    if (data || !courseId) return;
    Promise.all([
      apiFetch(attemptId ? `/quiz/attempt/${attemptId}` : `/quiz/attempts/${courseId}`, token),
      apiFetch(`/courses/${courseId}`, token),
    ])
      .then(([result, course]) => setData({ result, course }))
      .catch(() => setNotFound(true));
  }, [data, courseId, token, attemptId]);

  useEffect(() => {
    if (!courseId) return;
    let ignore = false;
    apiFetch(`/courses/${courseId}/cheatsheet`, token)
      .then((sheet: { status: SheetStatus }) => {
        if (!ignore) setSheetStatus(sheet.status);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [courseId, token]);

  useEffect(() => {
    // The button below claims to know whether the course is finished, so it
    // asks rather than assuming it is looking at a course nobody has marked.
    if (!courseId || !data) return;
    let ignore = false;
    apiFetch(`/courses/${courseId}/progress`, token)
      .then((indices: number[]) => {
        const sections = data.course.sections.length;
        if (!ignore && sections > 0 && indices.length >= sections) setAllDone(true);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [courseId, data, token]);

  const ringRef = useRef<SVGCircleElement>(null);
  const trackRef = useRef<SVGCircleElement>(null);
  // The ring reads off the score on screen rather than the stored percentage,
  // so the number in the middle and the arc around it can never disagree.
  const shown = data ? shownScore({ total: data.result.total_score, max: data.result.max_score }) : null;
  const percentage = shown?.percentage ?? 0;

  const filled = (CIRCUMFERENCE * Math.min(percentage, 100)) / 100;
  const track = trackLength(filled);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timing: KeyframeAnimationOptions = {
      duration: SWEEP_MS,
      // Quick off the mark and a long glide into the score, so it arrives
      // rather than stops.
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    };
    ring.animate(
      [{ strokeDashoffset: CIRCUMFERENCE }, { strokeDashoffset: CIRCUMFERENCE - filled }],
      timing,
    );
    // The track gives way as the arc grows, so the gap holds throughout.
    trackRef.current?.animate(
      [
        { strokeDasharray: `${trackLength(0)} ${CIRCUMFERENCE}`, strokeDashoffset: -RING_GAP },
        { strokeDasharray: `${track} ${CIRCUMFERENCE}`, strokeDashoffset: -(filled + RING_GAP) },
      ],
      timing,
    );
  }, [filled, track]);

  useEffect(() => {
    // A mastery score means the course has been learned, so it marks itself
    // done — but only once the ring has finished filling, because the
    // celebration is the end of that sweep rather than a separate event.
    // Reading an old attempt out of the history is not earning it again, so
    // that view watches the ring fill and nothing more.
    if (attemptId || percentage < MASTERY_PCT || !courseId || !data || allDone) return;
    let live = true;
    const timers = [
      setTimeout(() => {
        if (!live) return;
        setCelebrating(true);
        Promise.all(
          data.course.sections.map((_, i) =>
            apiFetch(`/courses/${courseId}/progress/${i}`, token, { method: "POST" }),
          ),
        )
          .then(() => live && setAllDone(true))
          .catch(() => live && toast("Couldn't mark the course as completed.", "error"));
      }, SWEEP_MS),
      setTimeout(() => live && toast("Course marked as completed!", "success"), SWEEP_MS + TICK_MS),
    ];
    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
    // allDone is deliberately absent: it flips inside this effect, and reacting
    // to it would cancel the celebration halfway through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentage, courseId, data, token, attemptId]);

  function cardData() {
    const shownNow = shownScore({ total: data!.result.total_score, max: data!.result.max_score });
    const cardPct = Math.round(shownNow.percentage);
    return {
      courseTitle: data!.course.video_title || "A Parcourse course",
      score: shownNow.score,
      outOf: shownNow.outOf,
      percentage: cardPct,
      mastered: cardPct >= MASTERY_PCT,
      analysis: data!.result.prose_analysis,
      summary: summaryRows(countsOf(data!.result, cardPct)),
    };
  }

  async function shareResult() {
    if (!data) return;
    setSharing(true);
    try {
      const blob = await drawResultCard(cardData());
      const file = new File([blob], "parcourse-result.png", { type: "image/png" });
      // A phone can hand the file to its share sheet; a desktop cannot.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast("Result card copied. Paste it wherever you like.", "success");
        return;
      } catch {
        download(blob, "parcourse-result.png");
        toast("Result card saved.", "success");
      }
    } catch (err) {
      // Someone dismissing the share sheet is not a failure worth shouting about.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast("The result card could not be made.", "error");
    } finally {
      setSharing(false);
    }
  }

  useLoadingToast(!data && !notFound, "Loading results…");

  if (notFound) {
    return (
      <div className="empty-state">
        <p className="status-message">No quiz result found for this course.</p>
        <button className="button primary" onClick={() => navigate(`/course/${courseId}`)}>
          Go to course
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { result, course } = data;

  const questionMap = new Map<string, string>();
  for (const s of course.sections) {
    for (const m of s.mcqs) questionMap.set(m.id, m.question);
    for (const t of s.theory_questions) questionMap.set(t.id, t.question);
  }

  const { score: totalScore, outOf: maxScore, note: roundingNote } = shownScore({
    total: result.total_score,
    max: result.max_score,
  });
  const pct = Math.round(percentage);

  const allResults = result.results;
  const rows = summaryRows(countsOf(result, pct));

  return (
    <div className="results-view">

      <section className="results-hero">
        <div className="score-stage">
          <div className="score-deco-frame" />
          <div className="score-orbit">
            <div className="score-blob-tr" />
            <div className="score-blob-bl" />
          </div>
          <div className="score-circle">
            <svg className="score-ring-svg" viewBox="0 0 120 120">
              <circle ref={trackRef} className="score-ring-bg" cx="60" cy="60" r={RING_R}
                strokeDasharray={`${track} ${CIRCUMFERENCE}`} strokeDashoffset={-(filled + RING_GAP)} />
              <circle ref={ringRef} className="score-ring-fill" cx="60" cy="60" r={RING_R}
                strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE - filled} />
            </svg>
            <div className="score-ring-label">
              <span className="score-ring-big">
                {totalScore}
                {roundingNote && (
                  <sup className="score-ring-star tip" data-tip={roundingNote} tabIndex={0} aria-label={roundingNote}>
                    *
                  </sup>
                )}
                <span className="score-ring-denom">/{maxScore}</span>
              </span>
              <span className="score-ring-sub">SCORE</span>
            </div>
            {celebrating && (
              <div className="score-complete">
                <svg className="score-complete-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <h1 className="results-headline">{headline(pct)}</h1>
        <p className="results-subtitle">{subtitle(pct)}</p>
      </section>

      <div className="results-grid">

        <div className="results-col">
          <h2 className="section-heading">Detailed Breakdown</h2>
          {allResults.map((r, idx) => {
            const skipped = r.feedback === "Question was skipped.";
            const isTheory = r.question_type === "theory";
            const tagClass = skipped ? "mist"
              : isTheory ? (r.score >= 4 ? "sage" : r.score >= 2.5 ? "mist" : "brick")
              : r.is_correct ? "sage" : "brick";
            const tagLabel = skipped ? "Skipped"
              : isTheory ? `${r.score.toFixed(1)} / 5`
              : r.is_correct ? "Correct" : "Incorrect";
            const dotClass = skipped ? "score-dot mist"
              : isTheory ? `score-dot ${tagClass}`
              : r.is_correct ? "score-dot sage" : "score-dot brick";
            return (
              <div className="card result-card" key={r.question_id}>
                <div className="result-card-header">
                  <span className="result-card-num">{idx + 1}</span>
                  <p className="question-text">{questionMap.get(r.question_id) ?? "Question"}</p>
                  <span className={dotClass} title={tagLabel}>
                    {skipped ? (
                      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    ) : isTheory ? (
                      <span className="score-dot-text">{r.score.toFixed(1)}</span>
                    ) : r.is_correct ? (
                      <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10"><line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </span>
                  <span className={`tag ${tagClass}`}>{tagLabel}</span>
                </div>
                {!skipped && <p className="result-feedback">{r.feedback}</p>}
                {isTheory && r.breakdown && (
                  <div className="dimension-bars">
                    {(["accuracy", "completeness", "relevance"] as const).map((dim) => (
                      <div className="dimension-row" key={dim}>
                        <span className="dimension-label">{dim}</span>
                        <div className="dimension-track">
                          <div className="dimension-fill" style={{ width: `${(r.breakdown![dim] / 5) * 100}%` }} />
                        </div>
                        <span className="dimension-score">{r.breakdown![dim]}/5</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="results-col">
          {result.prose_analysis && (
            <div className="ai-prose-card">
              <div className="ai-prose-pill">AI Tutor Analysis</div>
              <div className="ai-prose-body">
                <svg className="ai-prose-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 2L10.09 7.26L15 9L10.09 10.74L9 16L7.91 10.74L3 9L7.91 7.26L9 2Z"/>
                  <path d="M19 12L19.72 14.78L22.5 15.5L19.72 16.22L19 19L18.28 16.22L15.5 15.5L18.28 14.78L19 12Z"/>
                  <path d="M5 17L5.54 19.21L7.75 19.75L5.54 20.29L5 22.5L4.46 20.29L2.25 19.75L4.46 19.21L5 17Z"/>
                </svg>
                <p className="ai-prose-text">{result.prose_analysis}</p>
              </div>
            </div>
          )}

          <div className="tutor-card">
            <h3 className="tutor-card-heading">Performance Summary</h3>
            <div className="tutor-rows">
              {rows.map((row, i) => (
                <div className="tutor-row" key={i}>
                  <span className={`tutor-row-icon tutor-row-icon--${row.tone}`}>{row.tone === "good" ? "✓" : "→"}</span>
                  <span>{row.text}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="retake-btn mark-done-btn"
            disabled={markingDone || allDone}
            onClick={async () => {
              if (!courseId || !data) return;
              setMarkingDone(true);
              try {
                await Promise.all(
                  data.course.sections.map((_, i) =>
                    apiFetch(`/courses/${courseId}/progress/${i}`, token, { method: "POST" })
                  )
                );
                setAllDone(true);
                toast("Course marked as done!", "success");
              } catch {
                toast("Couldn't mark as done. Try again.", "error");
              } finally {
                setMarkingDone(false);
              }
            }}
          >
            {allDone ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                All sections done
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {markingDone ? "Saving…" : "Mark course as done"}
              </>
            )}
          </button>

          {/* Only when this page was reached from the history, because that is
              the only time there is a list to go back to. */}
          {attemptId && (
            <button className="retake-btn" onClick={() => navigate(`/course/${courseId}/history`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Quiz History
            </button>
          )}

          <button
            className={`retake-btn tip${sheetStatus === "pending" ? " disabled" : ""}`}
            data-tip={CHEATSHEET_HINT[sheetStatus]}
            aria-disabled={sheetStatus === "pending"}
            onClick={() => sheetStatus !== "pending" && navigate(`/course/${courseId}/cheatsheet`)}
          >
            {sheetStatus === "pending" ? (
              <span className="gen-pill-spinner" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="16" y2="11"/>
              </svg>
            )}
            <span className="cheatsheet-cta-label">Cheatsheet</span>
          </button>

          <button className="retake-btn" onClick={shareResult} disabled={sharing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {sharing ? "Making card…" : "Share result"}
          </button>

          <button className="retake-btn" onClick={() => navigate(`/course/${courseId}`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Retake Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
