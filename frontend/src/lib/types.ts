import type { SheetStatus } from "./cheatsheet";

export type Segment = { text: string; start: number; duration: number };

export type CourseEntry = {
  id: string;
  video_id: string;
  video_title: string;
  thumbnail_url: string;
  sections: { title: string }[];
  completed_sections: number[];
  has_passed_quiz: boolean;
  has_attempts: boolean;
  cheatsheet_status: SheetStatus;
};
