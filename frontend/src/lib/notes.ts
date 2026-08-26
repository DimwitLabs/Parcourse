import { apiFetch } from "./api";

export const SAVE_AFTER_TYPING_STOPS_MS = 900;

// Browsers cap a keepalive body at 64KB.
export const LARGEST_KEEPALIVE_BODY = 60_000;

export const LONGEST_SHEET_WORTH_KEEPING = 200_000;

export type SheetState = "loading" | "ready" | "failed";
export type SaveState = "saved" | "dirty" | "saving";

export const PLACEHOLDERS: Record<SheetState, string> = {
  loading: "Fetching your sheet.",
  failed: "Your sheet could not be fetched. Close this and open it again.",
  ready: "Anything worth keeping from this course.",
};

export type Note = {
  body: string;
  updated_at: string | null;
};

export function readNote(courseId: string, token: string | null): Promise<Note> {
  return apiFetch(`/notes/${courseId}`, token);
}

export function writeNote(
  courseId: string,
  token: string | null,
  body: string,
  outlivePage = false,
): Promise<Note> {
  return apiFetch(`/notes/${courseId}`, token, {
    method: "PUT",
    body: JSON.stringify({ body }),
    keepalive: outlivePage,
  });
}
