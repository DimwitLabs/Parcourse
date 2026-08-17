import { useEffect, useState } from "react";

export type GenStep = { key: string; label: string };

/** Regeneration clears the old course first, and skips the guardrail: the video
 *  already passed it once. */
export const REGEN_STEPS: readonly GenStep[] = [
  { key: "clearing", label: "Clearing the old course" },
  { key: "transcript", label: "Extracting transcript" },
  { key: "generating", label: "Generating course" },
];

/** "" while the modal is still asking for feedback. */
export type RegenStep = "" | "clearing" | "transcript" | "generating";

export const FALLBACK_MESSAGES = [
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

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Rotates a message while a slow step runs. Pass a stable pool: a new array
 *  identity restarts the rotation. */
export function useRotatingMessage(active: boolean, pool: readonly string[]): string {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!active) {
      setMessage("");
      return;
    }
    const order = shuffle(pool);
    let index = 0;
    setMessage(order[0]);
    const timer = setInterval(() => {
      index = (index + 1) % order.length;
      setMessage(order[index]);
    }, 4000);
    return () => clearInterval(timer);
  }, [active, pool]);
  return message;
}

type Props = {
  steps: readonly GenStep[];
  /** Key of the step in flight. Steps before it read as done. */
  current: string;
  /** Shown under the active step. */
  note?: string;
  /** Turns the current step red and explains why. */
  blockedReason?: string;
  onOverride?: () => void;
  className?: string;
};

export default function GenerationSteps({
  steps,
  current,
  note,
  blockedReason,
  onOverride,
  className = "gen-steps",
}: Props) {
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <div className={className}>
      {steps.map(({ key, label }, i) => {
        const isBlocked = !!blockedReason && key === current;
        const isActive = !blockedReason && key === current;
        const isDone = currentIdx > i;
        return (
          <div
            key={key}
            className={`gen-pill${isBlocked ? " blocked" : isActive ? " active" : isDone ? " done" : ""}`}
          >
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
                {isBlocked && <span className="gen-pill-sub gen-pill-reason">{blockedReason}</span>}
                {isActive && note && <span className="gen-pill-sub">{note}</span>}
              </span>
            </div>
            {isBlocked && onOverride && (
              <button className="gen-pill-override" type="button" onClick={onOverride}>
                Proceed Anyway
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
