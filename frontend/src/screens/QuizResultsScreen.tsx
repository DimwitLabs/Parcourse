import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

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
};
type Course = {
  id: string;
  sections: {
    mcqs: { id: string; question: string }[];
    theory_questions: { id: string; question: string }[];
  }[];
};

function headline(percentage: number): string {
  if (percentage >= 90) return "Outstanding work.";
  if (percentage >= 70) return "Great job — you've mastered the basics.";
  if (percentage >= 40) return "Good start, some gaps remain.";
  return "Let's revisit the fundamentals.";
}

const CIRCUMFERENCE = 2 * Math.PI * 48;

export default function QuizResultsScreen() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [data, setData] = useState<{ result: QuizResult; course: Course } | null>(
    (location.state as { result: QuizResult; course: Course } | undefined) ?? null,
  );
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (data || !courseId) return;
    Promise.all([
      apiFetch(`/quiz/attempts/${courseId}`, token),
      apiFetch(`/course/${courseId}`, token),
    ])
      .then(([result, course]) => setData({ result, course }))
      .catch(() => setNotFound(true));
  }, [data, courseId, token]);

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

  if (!data) return <p className="status-message">Loading results…</p>;

  const { result, course } = data;
  const questionText = new Map<string, string>();
  for (const s of course.sections) {
    for (const m of s.mcqs) questionText.set(m.id, m.question);
    for (const t of s.theory_questions) questionText.set(t.id, t.question);
  }

  const pct = Math.round(result.percentage);
  const dashOffset = CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100;

  const mcqResults = result.results.filter((r) => r.question_type === "mcq");
  const theoryResults = result.results.filter((r) => r.question_type === "theory");
  const skippedCount = result.results.filter((r) => r.feedback === "Question was skipped.").length;
  const correctMcqCount = mcqResults.filter((r) => r.is_correct).length;
  const incorrectMcqCount = mcqResults.filter((r) => !r.is_correct && r.feedback !== "Question was skipped.").length;
  const strongTheoryCount = theoryResults.filter((r) => r.score >= 4).length;
  const weakTheoryCount = theoryResults.filter((r) => r.score < 3 && r.feedback !== "Question was skipped.").length;

  return (
    <div className="results-view">
      <div className="results-hero">
        <div className="score-ring">
          <svg viewBox="0 0 120 120">
            <circle className="score-ring-bg" cx="60" cy="60" r="48" />
            <circle
              className="score-ring-fill"
              cx="60"
              cy="60"
              r="48"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="score-ring-label">{pct}%</span>
        </div>
        <div className="results-hero-text">
          <h1>{headline(result.percentage)}</h1>
          <p>
            {result.total_score.toFixed(1)} / {result.max_score.toFixed(1)} points
          </p>
        </div>
      </div>

      <div className="results-grid">
        <div className="results-col">
          <h2 className="section-heading">Question breakdown</h2>

          {mcqResults.map((r) => {
            const skipped = r.feedback === "Question was skipped.";
            return (
              <div className="card result-card" key={r.question_id}>
                <div className="result-card-header">
                  <p className="question-text">{questionText.get(r.question_id) ?? "Question"}</p>
                  <span className={`tag ${r.is_correct ? "sage" : skipped ? "mist" : "brick"}`}>
                    {r.is_correct ? "Correct" : skipped ? "Skipped" : "Incorrect"}
                  </span>
                </div>
                <p className="quote">{r.feedback}</p>
              </div>
            );
          })}

          {theoryResults.map((r) => {
            const skipped = r.feedback === "Question was skipped.";
            return (
            <div className="card result-card" key={r.question_id}>
              <div className="result-card-header">
                <p className="question-text">{questionText.get(r.question_id) ?? "Question"}</p>
                <span className="tag mist">{skipped ? "Skipped" : `${r.score.toFixed(1)} / 5`}</span>
              </div>
              {r.breakdown && (
                <div className="dimension-bars">
                  {(["accuracy", "completeness", "relevance"] as const).map((dim) => (
                    <div className="dimension-row" key={dim}>
                      <span className="dimension-label">{dim}</span>
                      <div className="dimension-track">
                        <div
                          className="dimension-fill"
                          style={{ width: `${(r.breakdown![dim] / 5) * 100}%` }}
                        />
                      </div>
                      <span className="dimension-score">{r.breakdown![dim]}/5</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="quote">{r.feedback}</p>
            </div>
            );
          })}
        </div>

        <div className="results-col">
          <h2 className="section-heading">Tutor analysis</h2>
          <div className="ai-card">
            <div className="ai-card-eyebrow">
              <span className="spark">✦</span> AI Tutor
            </div>
            <div className="ai-card-grid">
              <div>
                <p className="eyebrow">Strengths</p>
                <ul className="ai-card-points">
                  {correctMcqCount > 0 && (
                    <li>
                      Answered {correctMcqCount} of {mcqResults.length} MCQs correctly.
                    </li>
                  )}
                  {strongTheoryCount > 0 && (
                    <li>
                      Strong depth on {strongTheoryCount} theory{" "}
                      {strongTheoryCount === 1 ? "question" : "questions"}.
                    </li>
                  )}
                  {pct >= 70 && <li>Solid overall grasp of the material.</li>}
                </ul>
              </div>
              <div>
                <p className="eyebrow">Areas to revisit</p>
                <ul className="ai-card-points">
                  {incorrectMcqCount > 0 && (
                    <li>
                      Review the {incorrectMcqCount} missed MCQ
                      {incorrectMcqCount === 1 ? "" : "s"}.
                    </li>
                  )}
                  {weakTheoryCount > 0 && (
                    <li>
                      Deepen understanding on {weakTheoryCount} theory response
                      {weakTheoryCount === 1 ? "" : "s"}.
                    </li>
                  )}
                  {skippedCount > 0 && (
                    <li>
                      You skipped {skippedCount} question{skippedCount === 1 ? "" : "s"} — try
                      answering {skippedCount === 1 ? "it" : "them"} on your next attempt.
                    </li>
                  )}
                  {pct < 70 && <li>Re-watch sections you found tricky before retaking.</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="button-row">
        <button className="button secondary" onClick={() => navigate(`/course/${courseId}`)}>
          Retake quiz
        </button>
        <button className="button primary" onClick={() => navigate("/")}>
          New course
        </button>
      </div>
    </div>
  );
}
