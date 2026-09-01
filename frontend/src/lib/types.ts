import type { SheetStatus } from "./cheatsheet";

export type Segment = { text: string; start: number; duration: number };
export type Chapter = { title: string; start_seconds: number; end_seconds: number };

export type CourseEntrySection = {
  title: string;
  summary?: string;
  key_takeaways?: string[];
  mcqs?: { question: string; options: { text: string }[] }[];
  theory_questions?: { question: string }[];
};

export type CourseEntry = {
  id: string;
  video_id: string;
  video_title: string;
  channel: string;
  channel_url: string;
  thumbnail_url: string;
  sections: CourseEntrySection[];
  completed_sections: number[];
  has_passed_quiz: boolean;
  has_attempts: boolean;
  cheatsheet_status: SheetStatus;
  created_at: string | null;
};
