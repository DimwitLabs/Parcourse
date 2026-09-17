export type LearningStyle =
  | "explorer"
  | "quick_study"
  | "deep_diver"
  | "storyteller"
  | "practitioner"
  | "exam_ready";

export const LEARNING_STYLES: { value: LearningStyle; name: string; identity: string; description: string }[] = [
  { value: "explorer", name: "Explorer", identity: "an Explorer", description: "An easygoing check-in after each part. Offers a balance of different questions." },
  { value: "quick_study", name: "Quick Study", identity: "a Quick Study", description: "Fast checks that keep you moving. Offers only choice-based questions." },
  { value: "deep_diver", name: "Deep Diver", identity: "a Deep Diver", description: "Questions that make you think things through. Offers mostly written questions." },
  { value: "storyteller", name: "Storyteller", identity: "a Storyteller", description: "Explain what you watched in your own words. Offers only written questions." },
  { value: "practitioner", name: "Practitioner", identity: "a Practitioner", description: "Quick checks, with a moment to reflect. Offers mostly choice-based questions." },
  { value: "exam_ready", name: "Exam Ready", identity: "Exam Ready", description: "The toughest workout before a test. Offers the most questions of both kinds." },
];

export function styleOf(style: LearningStyle) {
  return LEARNING_STYLES.find((s) => s.value === style) ?? LEARNING_STYLES[0];
}
