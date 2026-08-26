import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const HEADING_SCALE = ["1.5em", "1.3em", "1.15em", "1.05em", "1em"];

const marks = HighlightStyle.define([
  // Every delimiter a mark is made of arrives tagged this way, so dimming the
  // one tag fades ** and ## and ~~ alike once the mark they open is closed.
  { tag: tags.processingInstruction, color: "var(--color-ink-faint)", opacity: 0.55 },
  { tag: tags.strong, fontWeight: "700", color: "var(--color-ink)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", opacity: 0.7 },
  { tag: tags.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--color-secondary)" },
  { tag: tags.link, color: "var(--color-primary)" },
  { tag: tags.url, color: "var(--color-primary)", textDecoration: "underline" },
  { tag: tags.quote, color: "var(--color-ink-faint)", fontStyle: "italic" },
  ...HEADING_SCALE.map((size, level) => ({
    tag: tags[`heading${level + 1}` as "heading1"],
    fontWeight: "800",
    fontSize: size,
    color: "var(--color-ink)",
  })),
]);

const paper = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--color-ink-soft)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    fontSize: "0.86rem",
    lineHeight: "1.7",
    padding: "1.35rem",
    overflow: "auto",
  },
  ".cm-content": { padding: 0, caretColor: "var(--color-primary)" },
  ".cm-line": { padding: 0 },
  ".cm-placeholder": { color: "var(--color-ink-faint)", opacity: 0.7 },
  "&.cm-editor .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-secondary-container)",
  },
});

export function notesEditor(options: {
  host: HTMLElement;
  body: string;
  hint: string;
  longest: number;
  onEdit: (text: string) => void;
}) {
  return new EditorView({
    parent: options.host,
    state: EditorState.create({
      doc: options.body,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(marks),
        EditorView.lineWrapping,
        placeholder(options.hint),
        paper,
        EditorState.changeFilter.of((tr) => tr.newDoc.length <= options.longest),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onEdit(update.state.doc.toString());
        }),
      ],
    }),
  });
}
