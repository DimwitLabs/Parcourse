import { useState } from "react";
import { useNavigate } from "react-router-dom";

import CustomSelect from "./CustomSelect";
import LearningStyleIcon from "./LearningStyleIcon";
import GenerationSteps, { FALLBACK_MESSAGES, REGEN_STEPS, useRotatingMessage } from "./GenerationSteps";
import type { RegenStep } from "./GenerationSteps";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LEARNING_STYLES } from "../lib/learningStyle";
import type { LearningStyle } from "../lib/learningStyle";
import { useEscapeKey } from "../lib/useEscapeKey";

export type CourseAction = "delete" | "regenerate";

type Props = {
  action: CourseAction | null;
  course: { id: string; video_id: string; style: LearningStyle } | null;
  onClose: () => void;
  /** Called after a successful delete, to leave the page or drop the row. */
  onDeleted: () => void;
  onError: (message: string) => void;
};

export default function CourseActionModal({ action, course, onClose, onDeleted, onError }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [keepNotes, setKeepNotes] = useState(true);
  const [keepGraph, setKeepGraph] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [style, setStyle] = useState<LearningStyle | null>(null);
  const [step, setStep] = useState<RegenStep>("");
  const message = useRotatingMessage(step === "generating", FALLBACK_MESSAGES);

  useEscapeKey(!!action, () => { if (!busy) close(); });

  function close() {
    setKeepNotes(true);
    setKeepGraph(true);
    setFeedback("");
    setStyle(null);
    setStep("");
    onClose();
  }

  async function remove() {
    if (!course) return;
    setBusy(true);
    try {
      const query = `?keep_graph=${keepGraph}`;
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
      setStep("generating");
      const made = await apiFetch(`/courses/${course.id}/regenerate`, token, {
        method: "POST",
        body: JSON.stringify({ feedback, style: chosen, keep_notes: keepNotes, keep_graph: keepGraph }),
      });
      close();
      navigate(`/course/${made.id}`);
    } catch (err) {
      onError(errMsg(err));
      setStep("");
    } finally {
      setBusy(false);
    }
  }

  if (!action || !course) return null;
  const deleting = action === "delete";
  const chosen = style ?? course.style;
  const restyled = chosen !== course.style;

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
              : "This will rebuild the course from the same video. Tell us what to change, or switch the style for a different mix of questions. Quiz answers, scores and progress are cleared."}
          </p>
        )}

        {deleting && (
          <label className="modal-checkbox-row">
            <input
              type="checkbox"
              checked={keepGraph}
              onChange={(e) => setKeepGraph(e.target.checked)}
            />
            <span>Keep Knowledge Graph entries</span>
          </label>
        )}

        {!deleting && !step && (
          <div className="modal-field learning-style-field">
            <span className="modal-field-label">Learning style</span>
            <CustomSelect
              value={chosen}
              options={LEARNING_STYLES.map((option) => ({
                value: option.value,
                label: option.name,
                icon: <LearningStyleIcon style={option.value} size={14} />,
                badge: option.value === course.style ? "Current" : undefined,
              }))}
              onChange={(value) => setStyle(value as LearningStyle)}
              disabled={busy}
            />
          </div>
        )}

        {!deleting && !step && (
          <label className="modal-field">
            <span className="modal-field-label">{restyled ? "Anything else?" : "What looks wrong?"}</span>
            <textarea
              className="text-input boxed textarea modal-textarea"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={restyled ? "Optional. Anything else the new course should do better…" : "Sections were too long, the quiz missed the main argument…"}
              maxLength={1000}
              disabled={busy}
            />
            <span className="modal-field-hint">
              {restyled
                ? "Optional. The new style is reason enough."
                : "Required unless you switch style. Your feedback feeds straight into the new course generation."}
            </span>
          </label>
        )}

        {!deleting && !step && (
          <div className="modal-checkbox-pair">
            <label className="modal-checkbox-row">
              <input type="checkbox" checked={keepNotes} onChange={(e) => setKeepNotes(e.target.checked)} />
              <span>Retain my notes</span>
            </label>
            <label className="modal-checkbox-row">
              <input type="checkbox" checked={keepGraph} onChange={(e) => setKeepGraph(e.target.checked)} />
              <span>Keep Knowledge Graph entries</span>
            </label>
          </div>
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
              disabled={busy || (!deleting && !restyled && feedback.trim() === "")}
            >
              {busy ? (deleting ? "Deleting…" : "Regenerating…") : deleting ? "Delete" : "Regenerate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
