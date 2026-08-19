import { useState } from "react";

/** A password nobody can read back is easy to mistype, and a wrong one is only
 * ever reported after the form is sent. */
export default function PasswordInput({
  placeholder,
  autoComplete,
  value,
  onChange,
  disabled,
}: {
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="login-input-pill">
      <input
        className="text-input"
        type={shown ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className="icon-btn tip"
        data-tip={shown ? "Hide password" : "Show password"}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown((s) => !s)}
        disabled={disabled}
      >
        {shown ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  );
}
