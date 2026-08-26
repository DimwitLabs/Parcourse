import { useState } from "react";

const chevronIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
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

export default function NotesGuide({ onToggle }: { onToggle?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);

  function flip() {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  }

  return (
    <div className="notes-guide">
      {open && (
        <dl className="notes-marks">
          {MARKS.map((mark) => (
            <div key={mark.name}>
              <dt><span className="notes-key">{mark.sample}</span></dt>
              <dd>{mark.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      <button className={`notes-guide-toggle${open ? " on" : ""}`} onClick={flip} aria-expanded={open}>
        Markdown
        <span className={`notes-chevron${open ? " up" : ""}`}>{chevronIcon}</span>
      </button>
    </div>
  );
}
