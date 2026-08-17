import { useState } from "react";
import { useNavigate } from "react-router-dom";

import GenerationSteps, { FALLBACK_MESSAGES, REGEN_STEPS, useRotatingMessage } from "./GenerationSteps";
import type { RegenStep } from "./GenerationSteps";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useEscapeKey } from "../lib/useEscapeKey";
import type { Segment } from "../lib/types";

export type CourseAction = "delete" | "regenerate";

type Props = {
  action: CourseAction | null;
  course: { id: string; video_id: string } | null;
  onClose: () => void;
  /** Called after a successful delete, to leave the page or drop the row. */
  onDeleted: () => void;
  onError: (message: string) => void;
};

export default function CourseActionModal({ action, course, onClose, onDeleted, onError }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [cleanupGraph, setCleanupGraph] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [step, setStep] = useState<RegenStep>("");
  const message = useRotatingMessage(step === "generating", FALLBACK_MESSAGES);

  useEscapeKey(!!action, () => { if (!busy) close(); });

  function close() {
    setCleanupGraph(false);
    setFeedback("");
    setStep("");
    onClose();
  }

  async function remove() {
    if (!course) return;
    setBusy(true);
    try {
      const query = cleanupGraph ? "?cleanup_graph=true" : "";
      await apiFetch(`/courses/${course.id}${query}`, token, { method: "DELETE" });
      close();
      onDeleted();
    } catch (err) {
      onError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!course) return;
    setBusy(true);
    try {
      setStep("clearing");
      await apiFetch(`/courses/${course.id}`, token, { method: "DELETE" });

      setStep("transcript");
      const transcript = await apiFetch("/transcript/extract", token, {
        method: "POST",
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${course.video_id}` }),
      });
      const segments: Segment[] = transcript.segments;

      setStep("generating");
      const created = await apiFetch("/courses/generate", token, {
        method: "POST",
        body: JSON.stringify({
          video_id: course.video_id,
          video_title: transcript.video_title ?? "",
          feedback,
          segments,
        }),
      });
      close();
      navigate(`/course/${created.id}`);
    } catch (err) {
      onError(errMsg(err));
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  if (!action || !course) return null;
  const deleting = action === "delete";

  return (
    <div className="modal-overlay" onClick={() => !busy && close()}>
      <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>
          {deleting ? "Delete course" : "Regenerate course"}
        </h2>

        {!step && (
          <p style={{ margin: "0 0 1rem", color: "var(--color-ink-soft)" }}>
            {deleting
              ? "This will permanently delete this course and all associated quiz data."
              : "This will delete the current course and regenerate it from scratch using the same video."}
          </p>
        )}

        {deleting && (
          <label className="modal-checkbox-row">
            <input
              type="checkbox"
              checked={cleanupGraph}
              onChange={(e) => setCleanupGraph(e.target.checked)}
            />
            <span>Also remove knowledge graph entries from this course</span>
          </label>
        )}

        {!deleting && !step && (
          <label className="modal-field">
            <span className="modal-field-label">What looks wrong?</span>
            <textarea
              className="text-input boxed textarea modal-textarea"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Sections were too long, the quiz missed the main argument…"
              maxLength={1000}
              disabled={busy}
            />
            <span className="modal-field-hint">
              Required. Your feedback feeds straight into the new course generation.
            </span>
          </label>
        )}

        {step && <GenerationSteps steps={REGEN_STEPS} current={step} note={message} />}

        {!step && (
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button className="button secondary" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button
              className={`button ${deleting ? "danger" : "primary"}`}
              onClick={deleting ? remove : regenerate}
              disabled={busy || (!deleting && !feedback.trim())}
            >
              {busy ? (deleting ? "Deleting…" : "Regenerating…") : deleting ? "Delete" : "Regenerate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
