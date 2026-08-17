import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";

import GenerationSteps, { FALLBACK_MESSAGES, useRotatingMessage } from "../components/GenerationSteps";
import type { GenStep } from "../components/GenerationSteps";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CourseEntry, Segment } from "../lib/types";

type Step = "idle" | "transcript" | "guardrail" | "guardrail-blocked" | "generating";
type PendingTranscript = { videoId: string; videoTitle: string; segments: Segment[] };

const GEN_STEPS: readonly GenStep[] = [
  { key: "transcript", label: "Extracting transcript" },
  { key: "guardrail", label: "Checking content" },
  { key: "generating", label: "Generating course" },
];

const URL_PLACEHOLDER = "youtube.com/watch?v=…";
const SUBMIT_LABEL = "Create course";

export default function HomeScreen() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [funMessages, setFunMessages] = useState<readonly string[]>(FALLBACK_MESSAGES);
  const [guardrailReason, setGuardrailReason] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTranscript | null>(null);
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);
  // Fails closed: an unanswered status call shows the gate, not a dead submit.
  const [aiReady, setAiReady] = useState(false);
  const [fillOrigin, setFillOrigin] = useState({ x: "50%", y: "50%" });

  useEffect(() => {
    apiFetch("/courses", token)
      .then(setCourses)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    apiFetch("/settings/ai-status", token)
      .then((d: { ready: boolean }) => setAiReady(d.ready))
      .catch(() => setAiReady(false));
  }, [token]);

  const funMsg = useRotatingMessage(step === "generating", funMessages);

  async function generate(videoId: string, videoTitle: string, segments: Segment[]) {
    setStep("generating");
    const courseData = await apiFetch("/courses/generate", token, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, video_title: videoTitle, segments }),
    });
    toast("Course ready!", "success");
    navigate(`/course/${courseData.id}`);
  }

  async function createCourse() {
    setFunMessages([...FALLBACK_MESSAGES]);
    try {
      setStep("transcript");
      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: videoUrl }),
      });

      const segments: Segment[] = transcriptData.segments;
      const videoTitle: string = transcriptData.video_title ?? "";
      const transcriptText = segments.map((s) => s.text).join(" ");
      setPending({ videoId: transcriptData.video_id, videoTitle, segments });

      setStep("guardrail");
      const guardrailData = await apiFetch("/guardrail/check", token, {
        method: "POST",
        body: JSON.stringify({ transcript: transcriptText }),
      });

      if (guardrailData.fun_messages?.length >= 3) {
        setFunMessages([...guardrailData.fun_messages, ...FALLBACK_MESSAGES]);
      }

      if (!guardrailData.is_learnable) {
        setGuardrailReason(guardrailData.reason ?? "This video isn't suitable for a course.");
        setStep("guardrail-blocked");
        return;
      }

      await generate(transcriptData.video_id, videoTitle, segments);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  async function proceedAnyway() {
    if (!pending) return;
    try {
      await generate(pending.videoId, pending.videoTitle, pending.segments);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  const isDone = (c: CourseEntry) =>
    c.has_passed_quiz || (c.completed_sections.length === c.sections.length && c.sections.length > 0);
  const recentCourses = courses?.filter((c) => !isDone(c)).slice(0, 3) ?? [];
  const totalSections = courses?.reduce((n, c) => n + c.sections.length, 0) ?? 0;

  const blocked = step === "guardrail-blocked";

  return (
    <>
      {busy && <div className="gen-overlay" />}

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

        <div className="url-form-wrap">
          {aiReady ? (
            <form
              className="url-form"
              onSubmit={(e) => {
                e.preventDefault();
                createCourse();
              }}
            >
              <input
                className="text-input"
                placeholder={URL_PLACEHOLDER}
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={busy}
              />
              <button className="button primary" type="submit" disabled={busy || !videoUrl}>
                {busy ? "Working…" : SUBMIT_LABEL}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="url-form url-form-gate"
              onClick={() => navigate("/settings")}
              onMouseEnter={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                setFillOrigin({ x: `${e.clientX - box.left}px`, y: `${e.clientY - box.top}px` });
              }}
              style={{ "--fill-x": fillOrigin.x, "--fill-y": fillOrigin.y } as CSSProperties}
              title={
                user?.role === "admin"
                  ? "No AI provider is set up yet"
                  : "No AI provider is set up yet. You can add your own."
              }
            >
              <span className="url-form-gate-resting">
                <span className="text-input">{URL_PLACEHOLDER}</span>
                <span className="button primary">{SUBMIT_LABEL}</span>
              </span>
              <span className="url-form-gate-label">Configure AI</span>
            </button>
          )}

          {busy && (
            <GenerationSteps
              className="gen-pills-panel"
              steps={GEN_STEPS}
              current={blocked ? "guardrail" : step}
              note={step === "generating" ? funMsg : undefined}
              blockedReason={blocked ? guardrailReason ?? undefined : undefined}
              onOverride={proceedAnyway}
            />
          )}
        </div>

        <p className="home-hint">Best with tutorials, lectures and explainers.</p>
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
                <h4 className="course-card-title">{c.video_title || c.sections[0]?.title || "Untitled course"}</h4>
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
            <span className="stat-label">Sections across all your courses.</span>
          </div>
        </div>
      )}
    </>
  );
}
