export type SheetStatus = "pending" | "ready" | "failed";

export type CheatsheetSection = {
  number: number;
  title: string;
  stamp: string;
  startSeconds: number;
  points: string[];
};

export type Cheatsheet = {
  status: SheetStatus;
  title: string;
  videoId: string;
  sections: CheatsheetSection[];
};

type SourceSection = {
  title: string;
  start_seconds: number;
  points: string[];
};

type SourceSheet = {
  status: SheetStatus;
  video_id: string;
  video_title?: string;
  sections: SourceSection[];
};

export function stampOf(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(whole / 60);
  const ss = whole % 60;
  const hh = Math.floor(mm / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm % 60)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

export function watchUrl(videoId: string, seconds: number) {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(seconds))}s`;
}

export function buildCheatsheet(sheet: SourceSheet): Cheatsheet {
  return {
    status: sheet.status,
    title: sheet.video_title?.trim() || "Untitled course",
    videoId: sheet.video_id,
    sections: (sheet.sections ?? []).map((s, i) => ({
      number: i + 1,
      title: s.title,
      stamp: stampOf(s.start_seconds),
      startSeconds: s.start_seconds,
      points: s.points ?? [],
    })),
  };
}

export function fileNameOf(sheet: Cheatsheet) {
  const title = sheet.title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `[Parcourse] Cheatsheet - ${title || "Untitled course"}.pdf`;
}
