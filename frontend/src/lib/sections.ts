export type Span = { start_seconds: number; end_seconds: number };

export const JUST_CROSSED_SECONDS = 2;

export function crossing(sections: Span[], at: number, was: number) {
  const now = sections.findIndex((s) => at >= s.start_seconds && at < s.end_seconds);
  if (now === -1) return { now, ended: -1 };

  const arrived = at - sections[now].start_seconds <= JUST_CROSSED_SECONDS;
  const ended = was >= 0 && now === was + 1 && arrived ? was : -1;
  return { now, ended };
}
