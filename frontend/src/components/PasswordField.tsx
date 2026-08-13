import { useState } from "react";

import { PASSWORD_RULE, generatePassword } from "../lib/password";

export default function PasswordField({
  value,
  onChange,
  disabled,
  hint = "Share this with the user. They will be asked to change it on first sign in.",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <label className="modal-field">
      <div className="password-field">
        <input
          className="text-input boxed"
          type="text"
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={copy}
          disabled={disabled || !value}
          title={copied ? "Copied" : "Copy password"}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(generatePassword())}
          disabled={disabled}
          title="Generate a new password"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
      <span className="modal-field-hint">{hint}</span>
      <span className="modal-field-hint">{PASSWORD_RULE}</span>
    </label>
  );
}
