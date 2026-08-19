import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MASTERY_PCT } from "../lib/score";

type Attempt = {
  id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  created_at: string;
};

export default function QuizHistoryScreen() {
  const { courseId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    apiFetch(`/quiz/attempts/${courseId}/history`, token)
      .then(setAttempts)
      .catch((e) => setError(errMsg(e)));
  }, [courseId, token]);

  if (error) return <p className="error-message" style={{ padding: "2rem" }}>{error}</p>;

  // Mastery is earned once. The list runs newest first, so the attempt that
  // earned it is the last one in the list that cleared the line.
  const masteryIndex = (attempts ?? []).reduce(
    (earned, a, i) => (a.percentage >= MASTERY_PCT ? i : earned),
    -1,
  );

  return (
    <div className="notebook-view">
      <div className="page-header">
        <h1 className="page-header-title">Quiz History</h1>
        <p className="page-header-sub">Every attempt you have made at this quiz, newest first.</p>
      </div>

      {!attempts && <p className="status-message">Loading your attempts…</p>}

      {attempts && attempts.length === 0 && (
        <div className="empty-state">
          <h2 className="empty-state-title">No attempts yet</h2>
          <p className="empty-state-body">Submit the quiz once and it will be kept here.</p>
          <Link to={`/course/${courseId}`} className="button primary" style={{ display: "inline-block", marginTop: "1.5rem", textDecoration: "none" }}>
            Back to the course
          </Link>
        </div>
      )}

      {attempts && attempts.length > 0 && (
        <div className="attempt-list">
          {attempts.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="attempt-row card"
              onClick={() => navigate(`/course/${courseId}/results?attempt=${a.id}`)}
            >
              <span className="attempt-score">{Math.round(a.percentage)}%</span>
              <span className="attempt-detail">
                <span className="attempt-points">
                  {a.total_score} of {a.max_score} points
                </span>
                {/* Counted from the first ever try, so the number does not
                    change as newer attempts arrive above it. */}
                <span className="attempt-meta">Attempt #{attempts.length - i}</span>
              </span>
              <span className="attempt-tags">
                {i === 0 && <span className="attempt-badge">Latest</span>}
                {i === masteryIndex && (
                  <span className="attempt-badge mastery">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    Mastery earned
                  </span>
                )}
              </span>
              <svg className="attempt-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ))}

          {/* Closes the list the way the rows open it — same strip, same shape,
              so leaving looks like part of the page rather than a stray link. */}
          <Link className="attempt-row attempt-back card" to={`/course/${courseId}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Back to the course
          </Link>
        </div>
      )}
    </div>
  );
}
