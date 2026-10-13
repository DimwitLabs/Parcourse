import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import Avatar from "../components/Avatar";
import CustomSelect from "../components/CustomSelect";
import GenerationSteps, { REGEN_STEPS } from "../components/GenerationSteps";
import IconMenu from "../components/IconMenu";
import LearningStyleIcon from "../components/LearningStyleIcon";
import LearningStylePill from "../components/LearningStylePill";
import Modal from "../components/Modal";
import PasswordField from "../components/PasswordField";
import PasswordInput from "../components/PasswordInput";
import ThemeSwitch from "../components/ThemeSwitch";
import { toast, useLoadingToast } from "../components/Toast";
import { LEARNING_STYLES } from "../lib/learningStyle";
import { COLOUR_FAMILIES, RADII, SHADOWS } from "./tokens";

const PROVIDERS = [
  ...["Claude Opus 5.5", "Claude Sonnet 5.5", "Claude Haiku 4.5"].map((label) => ({ value: label, label, group: "Anthropic", tone: "primary" as const })),
  ...["GPT-6", "GPT-6 mini", "o5"].map((label) => ({ value: label, label, group: "OpenAI" })),
  ...["Gemini 3 Pro", "Gemini 3 Flash"].map((label) => ({ value: label, label, group: "Google" })),
  ...["Llama 5 70B", "Mistral Large 3", "Qwen 4", "DeepSeek V4", "Command A+"].map((label) => ({ value: label, label, group: "Open weights" })),
];

const STYLE_OPTIONS = LEARNING_STYLES.map((s) => ({ value: s.value, label: s.name, icon: <LearningStyleIcon style={s.value} size={14} /> }));

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="card settings-section">
      <h2 className="settings-section-title">{title}</h2>
      {note && <p className="settings-section-desc">{note}</p>}
      <div className="ds-card-body">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-row">
      <span className="ds-row-label">{label}</span>
      <div className="ds-row-body">{children}</div>
    </div>
  );
}

function LoadingToastFor({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  useLoadingToast(true, "Building your course…");
  useEffect(() => {
    const timer = setTimeout(onDone, seconds * 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return null;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${text}`, "success");
  } catch {
    toast(`This browser blocks copying. The value is ${text}`, "error");
  }
}

/** Reads back the painted pixel, so light-dark(), oklch() and alpha all land as one sRGB hex. */
function toHex(colour: string): string {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = colour;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const bytes = a === 255 ? [r, g, b] : [r, g, b, a];
  return `#${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function useThemeRepaint(): number {
  const [painted, setPainted] = useState(0);
  useEffect(() => {
    const repaint = () => setPainted((count) => count + 1);
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, { attributes: true });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", repaint);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", repaint);
    };
  }, []);
  return painted;
}

function Swatch({ token, painted }: { token: string; painted: number }) {
  const chip = useRef<HTMLSpanElement>(null);
  const [hex, setHex] = useState("");

  useLayoutEffect(() => {
    if (chip.current) setHex(toHex(getComputedStyle(chip.current).backgroundColor));
  }, [painted]);

  return (
    <button type="button" className="ds-swatch" aria-label={`Copy ${hex}, ${token}`} onClick={() => copy(hex)}>
      <span ref={chip} className="ds-swatch-chip" style={{ background: `var(${token})` }} />
      <span className="ds-swatch-name">{token.replace("--color-", "")}</span>
      <code>{hex}</code>
    </button>
  );
}

function Colour() {
  const painted = useThemeRepaint();
  return (
    <>
      <p className="ds-plain settings-section-desc">Click a swatch to copy its hex in the current theme.</p>
      {COLOUR_FAMILIES.map((family) => (
        <Card key={family.name} title={family.name}>
          <div className="ds-swatches">
            {family.tokens.map((token) => (
              <Swatch key={token} token={token} painted={painted} />
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

function Surfaces() {
  return (
    <>
      <Card title="Cards" note="The default surface, and the quieter one for secondary content.">
        <div className="ds-pair">
          <div className="card">
            <p className="eyebrow">card</p>
            <p className="ds-plain">A block of content.</p>
          </div>
          <div className="card muted">
            <p className="eyebrow">card muted</p>
            <p className="ds-plain">Secondary content.</p>
          </div>
        </div>
        <div className="admin-kpi-row">
          <div className="admin-kpi card">
            <b>v1.8.2</b>
            <span>Version</span>
          </div>
          <div className="admin-kpi card">
            <b>12</b>
            <span>Courses generated</span>
          </div>
        </div>
      </Card>
      <Card title="Shadows">
        <div className="ds-tiles">
          {SHADOWS.map((token) => (
            <figure key={token} className="ds-tile">
              <span className="ds-shadow" style={{ boxShadow: `var(${token})` }} />
              <figcaption>{token.replace("--shadow-", "")}</figcaption>
            </figure>
          ))}
        </div>
      </Card>
      <Card title="Corners">
        <div className="ds-tiles">
          {RADII.map((token) => (
            <figure key={token} className="ds-tile">
              <span className="ds-radius" style={{ borderRadius: `var(${token})` }} />
              <figcaption>{token.replace("--radius-", "")}</figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </>
  );
}

function Type() {
  return (
    <Card title="Type" note="Plus Jakarta Sans throughout.">
      <Row label="Display">
        <p className="ds-display">Turn curiosity into knowledge.</p>
      </Row>
      <Row label="Page title">
        <h1 className="page-header-title">Settings</h1>
      </Row>
      <Row label="Section title">
        <h2 className="settings-section-title">Learning Style</h2>
      </Row>
      <Row label="Eyebrow">
        <p className="eyebrow">Continue learning</p>
      </Row>
      <Row label="Body">
        <p className="ds-plain">
          Paste a YouTube link and Parcourse breaks it down for you: structured sections, questions that test your thinking,
          and a knowledge map that grows with every course.
        </p>
      </Row>
      <Row label="Soft">
        <p className="settings-section-desc">Manage your account and API configuration.</p>
      </Row>
      <Row label="Tooltip">
        <span className="tip" data-tip="Shows on hover and on keyboard focus" tabIndex={0}>
          Hover or tab to me
        </span>
      </Row>
    </Card>
  );
}

function Buttons() {
  return (
    <Card title="Buttons" note="Tab through them: each shows a focus ring, and disabled ones are skipped.">
      <Row label="Primary">
        <button className="button primary">Create course</button>
      </Row>
      <Row label="Secondary">
        <button className="button secondary">Cancel</button>
      </Row>
      <Row label="Danger">
        <button className="button danger">Delete</button>
      </Row>
      <Row label="Disabled">
        <button className="button primary" disabled>
          Create course
        </button>
      </Row>
      <Row label="Link">
        <button className="link-button">What's in it</button>
      </Row>
      <Row label="Icon">
        <button className="icon-btn tip" data-tip="Settings" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </Row>
      <Row label="Avatar">
        <Avatar user={{ email: "ada@example.com", first_name: "Ada", last_name: "Lovelace" }} size={40} />
      </Row>
    </Card>
  );
}

function Fields() {
  const [password, setPassword] = useState("");
  const [strong, setStrong] = useState("Correct-Horse-7");
  const [weak, setWeak] = useState("short");

  return (
    <>
      <Card title="Text" note="Boxed fields ring themselves on focus; pill fields ring the pill.">
        <Row label="Boxed">
          <input className="text-input boxed" placeholder="First name" />
        </Row>
        <Row label="Pill">
          <div className="login-input-pill">
            <input className="text-input" placeholder="you@example.com" type="email" />
          </div>
        </Row>
        <Row label="Label and hint">
          <label className="modal-field">
            <span className="modal-field-label">What looks wrong?</span>
            <textarea className="text-input boxed textarea modal-textarea" placeholder="Sections were too long…" />
            <span className="modal-field-hint">Your feedback feeds the next generation.</span>
          </label>
        </Row>
        <Row label="Error">
          <label className="modal-field">
            <span className="modal-field-label">Instance name</span>
            <input className="text-input boxed" defaultValue="amber-orchard" />
            <span className="modal-field-hint is-error">That name is taken.</span>
          </label>
        </Row>
      </Card>
      <Card title="Passwords">
        <Row label="Boxed">
          <PasswordInput placeholder="Password" autoComplete="new-password" value={password} onChange={setPassword} boxed />
        </Row>
        <Row label="Pill">
          <PasswordInput placeholder="Password" autoComplete="new-password" value={password} onChange={setPassword} />
        </Row>
        <Row label="Generated, valid">
          <PasswordField value={strong} onChange={setStrong} hint="Share this with the user." />
        </Row>
        <Row label="Failing the rules">
          <PasswordField value={weak} onChange={setWeak} />
        </Row>
      </Card>
      <Card title="Checkboxes">
        <div className="modal-checkbox-pair">
          <label className="modal-checkbox-row">
            <input type="checkbox" defaultChecked />
            <span>Retain my notes</span>
          </label>
          <label className="modal-checkbox-row">
            <input type="checkbox" />
            <span>Keep Knowledge Graph entries</span>
          </label>
        </div>
      </Card>
    </>
  );
}

function Choosers() {
  const [style, setStyle] = useState<string>(LEARNING_STYLES[0].value);
  const [model, setModel] = useState(PROVIDERS[0].value);
  const [sort, setSort] = useState("newest");

  return (
    <Card title="Choosers" note="Open each with the keyboard. Escape closes only the panel; the long list focuses its search.">
      <Row label="Short">
        <CustomSelect value={style} options={STYLE_OPTIONS} onChange={setStyle} />
      </Row>
      <Row label="Searchable">
        <CustomSelect value={model} options={PROVIDERS.map((p, i) => (i === 0 ? { ...p, badge: "Current" } : p))} onChange={setModel} />
      </Row>
      <Row label="Disabled">
        <CustomSelect value={model} options={PROVIDERS} onChange={setModel} disabled />
      </Row>
      <Row label="Icon menu">
        <IconMenu
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
          }
          label="Sort notes"
          value={sort}
          active={sort !== "newest"}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "title", label: "By title" },
          ]}
          onChange={setSort}
        />
      </Row>
    </Card>
  );
}

function Styles() {
  return (
    <Card title="Learning styles" note="Each style's pill and icon, as a course shows them.">
      {LEARNING_STYLES.map((s) => (
        <Row key={s.value} label={s.name}>
          <div className="ds-inline">
            <LearningStyleIcon style={s.value} size={24} />
            <LearningStylePill style={s.value} />
          </div>
        </Row>
      ))}
    </Card>
  );
}

function Feedback() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Card title="Toasts" note="They stack at the bottom. Errors stay until dismissed and are read out by screen readers.">
        <Row label="Success">
          <button className="button secondary" onClick={() => toast("Saved.", "success")}>
            Show
          </button>
        </Row>
        <Row label="Info">
          <button className="button secondary" onClick={() => toast("Your course is ready.", "info")}>
            Show
          </button>
        </Row>
        <Row label="Error">
          <button className="button secondary" onClick={() => toast("Could not reach the server. Try again.", "error")}>
            Show
          </button>
        </Row>
        <Row label="Loading">
          <button className="button secondary" onClick={() => setLoading(true)} disabled={loading}>
            {loading ? "Showing for 4 seconds" : "Show"}
          </button>
          {loading && <LoadingToastFor seconds={4} onDone={() => setLoading(false)} />}
        </Row>
      </Card>
      <Card title="Progress">
        <GenerationSteps steps={REGEN_STEPS} current="generating" note="Reading the transcript…" />
      </Card>
    </>
  );
}

function TestDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(PROVIDERS[0].value);

  return (
    <Modal label="Dialog under test" onClose={onClose} locked={busy}>
      <h2 className="ds-dialog-title">Dialog under test</h2>
      <p className="ds-dialog-body">
        While busy, neither Escape nor a click outside closes it.
      </p>
      <div className="modal-form">
        <div className="modal-field">
          <span className="modal-field-label">Model</span>
          <CustomSelect value={model} options={PROVIDERS} onChange={setModel} disabled={busy} />
        </div>
        <label className="modal-field">
          <span className="modal-field-label">A field inside</span>
          <input className="text-input boxed" placeholder="Focus me" disabled={busy} />
        </label>
        <label className="modal-checkbox-row">
          <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
          <span>Busy (locks the dialog)</span>
        </label>
      </div>
      <div className="ds-actions">
        <button className="button secondary" onClick={() => toast("Raised from inside the dialog.", "error")}>
          Error toast
        </button>
        <button className="button primary" onClick={onClose} disabled={busy}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <Modal label="Delete this course" onClose={onClose}>
      <h2 className="ds-dialog-title">Delete this course?</h2>
      <p className="ds-dialog-body">This permanently deletes the course and all its quiz data.</p>
      <label className="modal-field">
        <span className="modal-field-hint">
          Type <b>delete</b> to confirm
        </span>
        <input className="text-input boxed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <div className="ds-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button danger" disabled={typed !== "delete"} onClick={onClose}>
          Delete
        </button>
      </div>
    </Modal>
  );
}

function Dialogs() {
  const [open, setOpen] = useState<"test" | "confirm" | null>(null);

  return (
    <Card title="Dialogs" note="Focus moves into the dialog and returns to the button that opened it.">
      <Row label="Under test">
        <button className="button primary" onClick={() => setOpen("test")}>
          Open
        </button>
      </Row>
      <Row label="Confirmation">
        <button className="button danger" onClick={() => setOpen("confirm")}>
          Open
        </button>
      </Row>
      {open === "test" && <TestDialog onClose={() => setOpen(null)} />}
      {open === "confirm" && <ConfirmDialog onClose={() => setOpen(null)} />}
    </Card>
  );
}

const SECTIONS = [
  { id: "colour", label: "Colour", show: Colour },
  { id: "surfaces", label: "Surfaces", show: Surfaces },
  { id: "type", label: "Type", show: Type },
  { id: "buttons", label: "Buttons", show: Buttons },
  { id: "fields", label: "Fields", show: Fields },
  { id: "choosers", label: "Choosers", show: Choosers },
  { id: "styles", label: "Learning styles", show: Styles },
  { id: "feedback", label: "Feedback", show: Feedback },
  { id: "dialogs", label: "Dialogs", show: Dialogs },
];

function fromHash() {
  const id = window.location.hash.slice(1);
  return SECTIONS.some((section) => section.id === id) ? id : SECTIONS[0].id;
}

export default function DesignSystem() {
  const [current, setCurrent] = useState(fromHash);

  useEffect(() => {
    const follow = () => setCurrent(fromHash());
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  const Show = SECTIONS.find((section) => section.id === current)!.show;

  return (
    <>
      <div className="top-nav">
        <a href="#colour" className="top-nav-logo">
          <img src="/parcourse-wordmark.svg" alt="Parcourse" height="28" />
        </a>
        <ThemeSwitch className="ds-theme" />
      </div>

      <div className="app-shell">
        <div className="settings-view">
          <div className="page-header">
            <h1 className="page-header-title">Design system</h1>
            <p className="page-header-sub">Every shared component, in every state.</p>
          </div>

          <div className="settings-layout">
            <nav className="settings-sidebar" aria-label="Sections">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  className={section.id === current ? "active" : ""}
                  aria-current={section.id === current ? "page" : undefined}
                  ref={(el) => {
                    if (el && section.id === current) el.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  onClick={() => {
                    window.location.hash = section.id;
                  }}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            <div className="settings-pane">
              <Show />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
