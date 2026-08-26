import { markdownToHtml } from "./markdown";
import { escaped, sheetFileName } from "./sheetText";
import type { SheetSource } from "./sheetImage";

function stamped(when: Date) {
  return when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function notesSource(title: string, body: string): SheetSource {
  return {
    html: `
      <header class="notes-export-masthead">
        <img class="notes-export-logo" src="/parcourse-wordmark.svg" alt="Parcourse" />
        <span class="notes-export-eyebrow">Notes</span>
      </header>
      <h1 class="notes-export-course">${escaped(title)}</h1>
      <div class="notes-export-body">${markdownToHtml(body)}</div>
      <footer class="notes-export-footer">
        <span>Made with Parcourse</span>
        <span>${escaped(stamped(new Date()))}</span>
      </footer>`,
    className: "notes-export",
    seamSelector: ".notes-export-body > *",
  };
}

export function notesFileName(title: string, extension: string) {
  return sheetFileName("Notes", title, extension);
}
