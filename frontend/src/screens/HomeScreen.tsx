import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseEntry, Segment } from "../lib/types";

type Step = "idle" | "transcript" | "guardrail" | "guardrail-blocked" | "generating";
type PendingTranscript = { videoId: string; segments: Segment[] };

const FUN_MESSAGES = [
  "Warming up the neurons…",
  "Reading between the frames…",
  "Brewing a fresh batch of knowledge…",
  "Convincing the AI to pay attention…",
  "Turning video into brainpower…",
  "Sharpening the quiz pencils…",
  "Mapping out the knowledge galaxy…",
  "Almost there, the AI is thinking hard…",
  "Organising your curriculum…",
  "Distilling the good stuff…",
];

export default function HomeScreen() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [funMsg, setFunMsg] = useState("");
  const [guardrailReason, setGuardrailReason] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTranscript | null>(null);
  const funInterval = useRef<ReturnType<typeof setInterval>>();
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);

  useEffect(() => {
    apiFetch("/courses", token)
      .then(setCourses)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (step === "generating") {
      let idx = 0;
      setFunMsg(FUN_MESSAGES[0]);
      funInterval.current = setInterval(() => {
        idx = (idx + 1) % FUN_MESSAGES.length;
        setFunMsg(FUN_MESSAGES[idx]);
      }, 4000);
    } else {
      clearInterval(funInterval.current);
      setFunMsg("");
    }
    return () => clearInterval(funInterval.current);
  }, [step]);

  async function generate(videoId: string, segments: Segment[]) {
    setStep("generating");
    const courseData = await apiFetch("/courses/generate", token, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, segments }),
    });
    toast("Course ready!", "success");
    navigate(`/course/${courseData.id}`);
  }

  async function createCourse() {
    try {
      setStep("transcript");
      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: videoUrl }),
      });

      const segments: Segment[] = transcriptData.segments;
      const transcriptText = segments.map((s) => s.text).join(" ");
      setPending({ videoId: transcriptData.video_id, segments });

      setStep("guardrail");
      const guardrailData = await apiFetch("/guardrail/check", token, {
        method: "POST",
        body: JSON.stringify({ transcript: transcriptText }),
      });

      if (!guardrailData.is_learnable) {
        setGuardrailReason(guardrailData.reason ?? "This video isn't suitable for a course.");
        setStep("guardrail-blocked");
        return;
      }

      await generate(transcriptData.video_id, segments);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  async function proceedAnyway() {
    if (!pending) return;
    try {
      await generate(pending.videoId, pending.segments);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  const busy = step !== "idle";
  const isDone = (c: (typeof courses)[number]) =>
    c.has_passed_quiz || (c.completed_sections.length === c.sections.length && c.sections.length > 0);
  const recentCourses = courses?.filter((c) => !isDone(c)).slice(0, 3) ?? [];
  const totalSections = courses?.reduce((n, c) => n + c.sections.length, 0) ?? 0;

  const GEN_STEPS = [
    { key: "transcript" as Step, label: "Extracting transcript" },
    { key: "guardrail" as Step, label: "Checking content" },
    { key: "generating" as Step, label: "Generating course" },
  ] as const;
  const stepOrder = GEN_STEPS.map((s) => s.key);
  const blocked = step === "guardrail-blocked";
  const currentStepIdx = blocked
    ? stepOrder.indexOf("guardrail")
    : stepOrder.indexOf(step as (typeof stepOrder)[number]);

  return (
    <>
      {busy && <div className="gen-overlay" />}
      {busy && (
        <div className="gen-pills-panel">
          {GEN_STEPS.map(({ key, label }, i) => {
            const isDone = currentStepIdx > i;
            const isActive = !blocked && step === key;
            const isBlocked = blocked && key === "guardrail";
            return (
              <div key={key} className={`gen-pill${isBlocked ? " blocked" : isActive ? " active" : isDone ? " done" : ""}`}>
                <div className="gen-pill-left">
                  {isBlocked ? (
                    <svg className="gen-pill-icon gen-pill-warn" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2L12.5 12H1.5L7 2Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/><line x1="7" y1="6" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="10.5" r="0.75" fill="currentColor"/></svg>
                  ) : isDone ? (
                    <svg className="gen-pill-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.15"/><polyline points="3.5,7 6,9.5 10.5,4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : isActive ? (
                    <span className="gen-pill-spinner" />
                  ) : (
                    <span className="gen-pill-dot" />
                  )}
                  <span className="gen-pill-label">
                    {label}
                    {isBlocked && guardrailReason && (
                      <span className="gen-pill-sub gen-pill-reason">{guardrailReason}</span>
                    )}
                    {isActive && step === "generating" && funMsg && (
                      <span className="gen-pill-sub">{funMsg}</span>
                    )}
                  </span>
                </div>
                {isBlocked && (
                  <button className="gen-pill-override" onClick={proceedAnyway}>
                    Proceed Anyway
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="hero">
        <h1 className="hero-title">
          Turn curiosity
          <br />
          into <span className="accent">knowledge.</span>
        </h1>
        <p className="hero-subtitle">
          Paste a YouTube link and Parcourse breaks it down for you. Structured sections, questions
          that test your thinking, and a knowledge map that grows with every course.
        </p>

        <form
          className="url-form"
          onSubmit={(e) => {
            e.preventDefault();
            createCourse();
          }}
        >
          <input
            className="text-input"
            placeholder="youtube.com/watch?v=…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={busy}
          />
          <button className="button primary" type="submit" disabled={busy || !videoUrl}>
            {busy ? "Working…" : "Create course"}
          </button>
        </form>

        <p className="home-hint">Best with tutorials, lectures and explainers. Five to forty minutes.</p>
      </div>

      {recentCourses.length > 0 && (
        <>
          <div className="section-row">
            <h2 className="section-row-title">Continue learning</h2>
            {courses && courses.length > 3 && (
              <Link to="/notebook" className="section-row-link">
                View all {courses.length} →
              </Link>
            )}
          </div>
          <div className="course-grid">
            {recentCourses.map((c) => (
              <Link to={`/course/${c.id}`} key={c.id} className="course-card">
                <div className="course-card-thumb">
                  <img src={c.thumbnail_url} alt="" loading="lazy" />
                </div>
                <h4 className="course-card-title">{c.sections[0]?.title ?? "Untitled course"}</h4>
                <p className="course-card-meta">{c.sections.length} sections</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {courses && courses.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <b className="stat-big">{courses.length}</b>
            <span className="stat-label">
              {courses.length === 1 ? "Course generated so far." : "Courses generated so far."}
            </span>
          </div>
          <div className="stat-card">
            <b className="stat-big">{totalSections}</b>
            <span className="stat-label">Sections studied across all your courses.</span>
          </div>
        </div>
      )}
    </>
  );
}
