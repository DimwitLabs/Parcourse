import type { SaveState } from "../lib/notes";

const savedIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const dirtyIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);

const savingIcon = (
  <svg className="notes-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);

export default function NotesChip({ state, onSave }: { state: SaveState; onSave: () => void }) {
  if (state === "saving") {
    return <span className="notes-chip busy">{savingIcon}Saving</span>;
  }
  if (state === "dirty") {
    return <button className="notes-chip dirty" onClick={onSave}>{dirtyIcon}Save now</button>;
  }
  return <span className="notes-chip">{savedIcon}Saved</span>;
}
