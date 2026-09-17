import LearningStyleIcon from "./LearningStyleIcon";
import { styleOf } from "../lib/learningStyle";
import type { LearningStyle } from "../lib/learningStyle";

type Props = { style: LearningStyle; hint?: boolean; className?: string };

export default function LearningStylePill({ style, hint = true, className = "" }: Props) {
  const { name, description } = styleOf(style);
  return (
    <span
      className={`tag sage style-tag${hint ? " tip" : ""} ${className}`}
      data-tip={hint ? description : undefined}
      tabIndex={hint ? 0 : undefined}
    >
      <LearningStyleIcon style={style} size={12} />
      {name}
    </span>
  );
}
