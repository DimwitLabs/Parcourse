// The line the whole app calls mastery: the knowledge graph marks a node
// mastered at the same 0.9, so a course passes it at the same score.
export const MASTERY_PCT = 90;

// A quiz can score in halves, but a score reads better whole. Rounding is
// shown rather than hidden: the marks the ring fills to are the marks on
// screen, and an asterisk points back at what was actually scored.
export type Marks = { total: number; max: number };

export function shownScore({ total, max }: Marks) {
  const score = Math.round(total);
  const outOf = Math.round(max);
  return {
    score,
    outOf,
    percentage: outOf > 0 ? (score / outOf) * 100 : 0,
    // Nothing to explain when the score was whole to begin with.
    note: Math.abs(total - score) < 0.01 ? null : `Rounded from ${Number(total.toFixed(2))}`,
  };
}
