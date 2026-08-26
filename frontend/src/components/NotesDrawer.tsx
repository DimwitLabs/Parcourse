import { useCallback, useEffect, useRef, useState } from "react";

import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  readNote,
  writeNote,
  LARGEST_KEEPALIVE_BODY,
  LONGEST_SHEET_WORTH_KEEPING,
  SAVE_AFTER_TYPING_STOPS_MS,
} from "../lib/notes";
import { useEscapeKey } from "../lib/useEscapeKey";
import { toast } from "./Toast";

type SaveState = "saved" | "dirty" | "saving";
type SheetState = "loading" | "ready" | "failed";

const gripIcon = <span className="notes-tab-grip" aria-hidden="true" />;

const chevronIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
);

const closeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const savedIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const dirtyIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);

const savingIcon = (
  <svg className="notes-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);

const MARKS: { sample: React.ReactNode; meaning: React.ReactNode; name: string }[] = [
  { sample: <>**<b>b</b>**</>, meaning: <b>Bold</b>, name: "bold" },
  { sample: <>*<i>i</i>*</>, meaning: <i>Italic</i>, name: "italic" },
  { sample: <>~~<s>s</s>~~</>, meaning: <s>Struck through</s>, name: "strike" },
  { sample: <># … #####</>, meaning: <span className="notes-mark-heading">Five heading levels</span>, name: "heading" },
  { sample: <>-</>, meaning: "Bullets", name: "bullet" },
  { sample: <>1.</>, meaning: "Numbered", name: "number" },
  { sample: <>&gt;</>, meaning: <span className="notes-mark-quote">Quote</span>, name: "quote" },
  { sample: <>`<code>c</code>`</>, meaning: <code>Code</code>, name: "code" },
  { sample: <>[t](u)</>, meaning: <span className="notes-mark-link">Link</span>, name: "link" },
  { sample: <>---</>, meaning: "Divider", name: "divider" },
];



const PLACEHOLDERS: Record<SheetState, string> = {
  loading: "Fetching your sheet.",
  failed: "Your sheet could not be fetched. Close this and open it again.",
  ready: "Anything worth keeping from this course.",
};

export default function NotesDrawer({ courseId, title }: { courseId: string; title: string }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sheetState, setSheetState] = useState<SheetState>("loading");
  const [guideOpen, setGuideOpen] = useState(false);

  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);

  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<{ destroy(): void } | null>(null);
  const loaded = useRef(false);
  const pending = useRef<number | null>(null);
  const latest = useRef("");

  useEscapeKey(open, () => setOpen(false));

  // Read-only until the sheet arrives, so the answer cannot throw away what was
  // typed while it was in flight, and a failed read cannot save an empty sheet
  // over what is on the server.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    setSheetState("loading");
    readNote(courseId, token)
      .then((note) => {
        latest.current = note.body;
        setBody(note.body);
        setSheetState("ready");
      })
      .catch((err) => {
        loaded.current = false;
        setSheetState("failed");
        toast(errMsg(err), "error");
      });
  }, [open, courseId, token]);

  const save = useCallback(
    (text: string) => {
      pending.current = null;
      setSaveState("saving");
      writeNote(courseId, token, text)
        .then(() => {
          // A slower earlier write must not report a later edit as saved.
          if (latest.current === text) setSaveState("saved");
        })
        .catch((err) => {
          if (latest.current === text) setSaveState("dirty");
          toast(errMsg(err), "error");
        });
    },
    [courseId, token],
  );

  function edit(text: string) {
    latest.current = text;
    setBody(text);
    setSaveState("dirty");
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => save(text), SAVE_AFTER_TYPING_STOPS_MS);
  }

  function saveNow() {
    if (pending.current) window.clearTimeout(pending.current);
    save(body);
  }

  // A debounce still counting down when the screen goes is the last thing
  // typed, so leaving spends the write rather than cancelling it.
  useEffect(
    () => () => {
      if (pending.current === null) return;
      window.clearTimeout(pending.current);
      pending.current = null;
      const text = latest.current;
      writeNote(courseId, token, text, text.length <= LARGEST_KEEPALIVE_BODY).catch(() => undefined);
    },
    [courseId, token],
  );

  // Built only once the sheet has arrived, so the editor opens on the real text
  // rather than being handed it afterwards, and the whole of CodeMirror rides
  // with the drawer instead of the bundle everyone loads.
  useEffect(() => {
    if (!open || sheetState !== "ready" || !editorHost.current) return;
    let cancelled = false;
    import("../lib/notesEditor").then(({ notesEditor }) => {
      if (cancelled || !editorHost.current) return;
      editor.current = notesEditor({
        host: editorHost.current,
        body: latest.current,
        hint: PLACEHOLDERS.ready,
        longest: LONGEST_SHEET_WORTH_KEEPING,
        onEdit: edit,
      });
    });
    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, [open, sheetState]);

  async function exportSheet(kind: "png" | "pdf") {
    setExporting(kind);
    try {
      // Imported here rather than at the top so the markdown renderer stays
      // out of the bundle everyone loads and rides with the export instead.
      const { notesFileName, notesSource } = await import("../lib/notesMarkup");
      const source = notesSource(title, body);
      const name = notesFileName(title, kind);
      if (kind === "png") {
        const { sheetPng } = await import("../lib/sheetImage");
        await sheetPng(source, name);
      } else {
        const { sheetPdf } = await import("../lib/sheetPdf");
        await sheetPdf(source, name);
      }
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setExporting(null);
    }
  }

  const chip =
    saveState === "saving"
      ? { icon: savingIcon, label: "Saving", className: "notes-chip busy", press: null }
      : saveState === "dirty"
        ? { icon: dirtyIcon, label: "Save now", className: "notes-chip dirty", press: saveNow }
        : { icon: savedIcon, label: "Saved", className: "notes-chip", press: null };

  return (
    <>
      <button
        className={`notes-tab${open ? " hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open notes"
      >
        {gripIcon}
        <span>Notes</span>
      </button>

      {open && (
        <div className="notes-overlay">
          <div className="notes-backdrop" onClick={() => setOpen(false)} />
          <aside className="notes-sheet">
            <div className="notes-head">
              <span className="notes-title">
                Notes
                <span className="notes-sub">{title}</span>
              </span>
              {chip.press ? (
                <button className={chip.className} onClick={chip.press}>{chip.icon}{chip.label}</button>
              ) : (
                <span className={chip.className}>{chip.icon}{chip.label}</span>
              )}
              <button className="notes-icon-btn" onClick={() => setOpen(false)} aria-label="Close notes">
                {closeIcon}
              </button>
            </div>

            {sheetState === "ready" ? (
              <div className="notes-body" ref={editorHost} />
            ) : (
              <p className="notes-waiting">{PLACEHOLDERS[sheetState]}</p>
            )}

            <div className={`notes-tail${guideOpen ? " open" : ""}`}>
              <div className="notes-guide">
                {guideOpen && (
                  <dl className="notes-marks">
                    {MARKS.map((mark) => (
                      <div key={mark.name}>
                        <dt><span className="notes-key">{mark.sample}</span></dt>
                        <dd>{mark.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <button
                  className={`notes-guide-toggle${guideOpen ? " on" : ""}`}
                  onClick={() => setGuideOpen((was) => !was)}
                  aria-expanded={guideOpen}
                >
                  Markdown
                  <span className={`notes-chevron${guideOpen ? " up" : ""}`}>{chevronIcon}</span>
                </button>
              </div>
              <div className="notes-actions">
                <button
                  className="notes-export-btn"
                  onClick={() => exportSheet("png")}
                  disabled={exporting !== null || body.trim() === ""}
                >
                  {exporting === "png" ? "Drawing" : "PNG"}
                </button>
                <button
                  className="notes-export-btn"
                  onClick={() => exportSheet("pdf")}
                  disabled={exporting !== null || body.trim() === ""}
                >
                  {exporting === "pdf" ? "Building" : "PDF"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
