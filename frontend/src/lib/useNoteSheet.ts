import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "../components/Toast";
import { errMsg } from "./api";
import { useAuth } from "./auth";
import {
  LARGEST_KEEPALIVE_BODY,
  LONGEST_SHEET_WORTH_KEEPING,
  SAVE_AFTER_TYPING_STOPS_MS,
  readNote,
  writeNote,
} from "./notes";
import type { SaveState, SheetState } from "./notes";

export function useNoteSheet(courseId: string, hint: string, wanted: boolean) {
  const { token } = useAuth();
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [sheetState, setSheetState] = useState<SheetState>("loading");

  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<{ destroy(): void } | null>(null);
  const loaded = useRef(false);
  const pending = useRef<number | null>(null);
  const latest = useRef("");

  // Read-only until the sheet arrives, so the answer cannot throw away what was
  // typed while it was in flight, and a failed read cannot save an empty sheet
  // over what is on the server.
  useEffect(() => {
    if (!wanted || loaded.current) return;
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
  }, [wanted, courseId, token]);

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

  const edit = useCallback(
    (text: string) => {
      latest.current = text;
      setBody(text);
      setSaveState("dirty");
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => save(text), SAVE_AFTER_TYPING_STOPS_MS);
    },
    [save],
  );

  function saveNow() {
    if (pending.current) window.clearTimeout(pending.current);
    save(latest.current);
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
  // with whatever asked for it instead of the bundle everyone loads.
  useEffect(() => {
    if (!wanted || sheetState !== "ready" || !editorHost.current) return;
    let cancelled = false;
    import("./notesEditor").then(({ notesEditor }) => {
      if (cancelled || !editorHost.current) return;
      editor.current = notesEditor({
        host: editorHost.current,
        body: latest.current,
        hint,
        longest: LONGEST_SHEET_WORTH_KEEPING,
        onEdit: edit,
      });
    });
    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, [wanted, sheetState, hint, edit]);

  return { body, sheetState, saveState, saveNow, editorHost };
}
