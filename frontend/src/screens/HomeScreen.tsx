import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";

import GenerationSteps, { FALLBACK_MESSAGES, useRotatingMessage } from "../components/GenerationSteps";
import type { GenStep } from "../components/GenerationSteps";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { youTubeVideoId, youTubeWatchUrl } from "../lib/youtube";
import type { Chapter, CourseEntry, Segment } from "../lib/types";

type Step = "idle" | "transcript" | "chapters-asked" | "guardrail" | "guardrail-blocked" | "generating";
type PendingTranscript = { videoId: string; videoTitle: string; segments: Segment[]; chapters: Chapter[] };

const GEN_STEPS: readonly GenStep[] = [
  { key: "transcript", label: "Extracting transcript" },
  { key: "guardrail", label: "Checking content" },
  { key: "generating", label: "Generating course" },
];

/** One chapter is the whole video, so there is nothing to choose between. */
const LEAST_CHAPTERS_WORTH_FOLLOWING = 2;

const URL_PLACEHOLDER = "youtube.com/watch?v=…";
const SUBMIT_LABEL = "Create course";

const NOT_YOUTUBE = [
  "Hmm, that doesn't look like a YouTube link",
  "Are you sure that is a YouTube video?",
  "Parcourse only works with YouTube links",
];

const HOME_HINT = "Best with tutorials, lectures and explainers.";
const TYPED_HINTS = [
  "Typing a link by hand? Interesting.",
  "Waiting for this to turn into a YouTube link",
  "This is not a YouTube link. Yet.",
];

export default function HomeScreen() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [funMessages, setFunMessages] = useState<readonly string[]>(FALLBACK_MESSAGES);
  const [guardrailReason, setGuardrailReason] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTranscript | null>(null);
  const [following, setFollowing] = useState<Chapter[]>([]);
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [fillOrigin, setFillOrigin] = useState({ x: "50%", y: "50%" });
  const [handedOver, setHandedOver] = useState<string | null>(null);
  const rejection = useRef(0);
  const typedHint = useRef(0);
  const [hint, setHint] = useState(TYPED_HINTS[0]);

  useEffect(() => {
    apiFetch("/courses", token)
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [token]);

  useEffect(() => {
    apiFetch("/settings/ai-status", token)
      .then((d: { ready: boolean }) => setAiReady(d.ready))
      .catch(() => setAiReady(false));
  }, [token]);

  useEffect(() => {
    const url = youTubeWatchUrl(new URLSearchParams(window.location.search).get("v") ?? "");
    if (!url) return;
    setVideoUrl(url);
    setHandedOver(url);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const funMsg = useRotatingMessage(step === "generating", funMessages);

  async function generate(video: PendingTranscript, chapters: Chapter[]) {
    setStep("generating");
    const courseData = await apiFetch("/courses/generate", token, {
      method: "POST",
      body: JSON.stringify({
        video_id: video.videoId,
        video_title: video.videoTitle,
        segments: video.segments,
        chapters,
      }),
    });
    toast("Course ready!", "success");
    navigate(`/course/${courseData.id}`);
  }

  async function checkThenGenerate(video: PendingTranscript, chapters: Chapter[]) {
    setFollowing(chapters);
    setStep("guardrail");
    const guardrailData = await apiFetch("/guardrail/check", token, {
      method: "POST",
      body: JSON.stringify({ transcript: video.segments.map((s) => s.text).join(" ") }),
    });

    if (guardrailData.fun_messages?.length >= 3) {
      setFunMessages([...guardrailData.fun_messages, ...FALLBACK_MESSAGES]);
    }

    if (!guardrailData.is_learnable) {
      setGuardrailReason(guardrailData.reason ?? "This video isn't suitable for a course.");
      setStep("guardrail-blocked");
      return;
    }

    await generate(video, chapters);
  }

  async function createCourse(url = videoUrl) {
    const already = courses?.find((c) => c.video_id === youTubeVideoId(url));
    if (already) {
      toast("You already have a course from this video.", "info");
      navigate(`/course/${already.id}`);
      return;
    }

    setFunMessages([...FALLBACK_MESSAGES]);
    try {
      setStep("transcript");
      const transcriptData = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url }),
      });

      const video: PendingTranscript = {
        videoId: transcriptData.video_id,
        videoTitle: transcriptData.video_title ?? "",
        segments: transcriptData.segments,
        chapters: transcriptData.chapters ?? [],
      };
      setPending(video);

      if (video.chapters.length >= LEAST_CHAPTERS_WORTH_FOLLOWING) {
        setStep("chapters-asked");
        return;
      }

      await checkThenGenerate(video, []);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  function dismissBlocked() {
    setStep("idle");
    setGuardrailReason(null);
    setPending(null);
    setFollowing([]);
    setVideoUrl("");
  }

  async function answerChapters(chapters: Chapter[]) {
    if (!pending) return;
    try {
      await checkThenGenerate(pending, chapters);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  async function proceedAnyway() {
    if (!pending) return;
    try {
      await generate(pending, following);
    } catch (err) {
      toast(errMsg(err), "error");
      setStep("idle");
    }
  }

  useEffect(() => {
    if (!handedOver || !aiReady || !courses || step !== "idle") return;
    setHandedOver(null);
    createCourse(handedOver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOver, aiReady, courses, step]);

  const busy = step !== "idle";

  const isDone = (c: CourseEntry) =>
    c.has_passed_quiz || (c.completed_sections.length === c.sections.length && c.sections.length > 0);
  const recentCourses = courses?.filter((c) => !isDone(c)).slice(0, 3) ?? [];
  const totalSections = courses?.reduce((n, c) => n + c.sections.length, 0) ?? 0;

  const blocked = step === "guardrail-blocked";
  const asking = step === "chapters-asked";
  const linkOk = youTubeVideoId(videoUrl) !== null;
  const halfWritten = videoUrl !== "" && !linkOk;

  useEffect(() => {
    if (!halfWritten) return;
    setHint(TYPED_HINTS[typedHint.current % TYPED_HINTS.length]);
    typedHint.current += 1;
  }, [halfWritten]);

  function guardPaste(e: ClipboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + e.clipboardData.getData("text") + input.value.slice(end);
    if (youTubeVideoId(next)) return;
    e.preventDefault();
    toast(NOT_YOUTUBE[rejection.current % NOT_YOUTUBE.length], "error");
    rejection.current += 1;
  }

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
                onPaste={guardPaste}
                disabled={busy}
              />
              <button className="button primary" type="submit" disabled={busy || !linkOk}>
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
              current={blocked ? "guardrail" : asking ? "transcript" : step}
              note={step === "generating" ? funMsg : undefined}
              tone={asking ? "ask" : "warn"}
              blockedReason={
                blocked
                  ? guardrailReason ?? undefined
                  : asking
                    ? `It seems the creator already split this video into ${pending?.chapters.length} chapters. Use them or regenerate chapters?`
                    : undefined
              }
              onOverride={asking ? () => answerChapters(pending?.chapters ?? []) : proceedAnyway}
              overrideLabel={asking ? "Use theirs" : undefined}
              onCancel={asking ? () => answerChapters([]) : dismissBlocked}
              cancelLabel={asking ? "Regenerate" : undefined}
            />
          )}
        </div>

        <p className="home-hint">{halfWritten ? hint : HOME_HINT}</p>
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
