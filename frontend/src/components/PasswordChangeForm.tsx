import { useState } from "react";

import PasswordInput from "./PasswordInput";
import { PASSWORD_RULE, passwordError } from "../lib/password";

export default function PasswordChangeForm({
  requireCurrent,
  boxed = false,
  className,
  buttonClassName,
  submitLabel,
  busy,
  onSubmit,
}: {
  requireCurrent: boolean;
  boxed?: boolean;
  className: string;
  buttonClassName: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (values: { current: string; password: string }) => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const showNew = requireCurrent === false || current.length > 0;
  const showConfirm = showNew && password.length > 0;

  function changeCurrent(v: string) {
    setCurrent(v);
    if (v.length === 0) {
      setPassword("");
      setConfirm("");
    }
  }

  function changeNew(v: string) {
    setPassword(v);
    if (v.length === 0) setConfirm("");
  }

  const policyProblem = password.length > 0 ? passwordError(password) : null;
  const mismatch = confirm.length > 0 && password !== confirm;
  const problem = policyProblem ?? (mismatch ? "Those passwords do not match." : null);
  const canSubmit =
    passwordError(password) === null &&
    password === confirm &&
    (requireCurrent ? current.length > 0 : true) &&
    busy === false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit === false) return;
    await onSubmit({ current, password });
    setCurrent("");
    setPassword("");
    setConfirm("");
  }

  return (
    <form className={className} onSubmit={submit}>
      {requireCurrent && (
        <PasswordInput
          placeholder="Current password"
          autoComplete="current-password"
          value={current}
          onChange={changeCurrent}
          disabled={busy}
          boxed={boxed}
        />
      )}
      {showNew && (
        <PasswordInput
          placeholder="New password"
          autoComplete="new-password"
          value={password}
          onChange={changeNew}
          disabled={busy}
          boxed={boxed}
        />
      )}
      {showConfirm && (
        <PasswordInput
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          disabled={busy}
          boxed={boxed}
        />
      )}
      {showNew && (
        <span className={`modal-field-hint${problem ? " is-error" : ""}`}>
          {problem ?? PASSWORD_RULE}
        </span>
      )}
      <button className={buttonClassName} type="submit" disabled={canSubmit === false}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
