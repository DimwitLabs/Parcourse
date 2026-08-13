import { useState } from "react";

import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PASSWORD_RULE, passwordError } from "../lib/password";

export default function ChangePasswordScreen() {
  const { token, user, setUser, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const policyError = password.length > 0 ? passwordError(password) : null;
  const mismatch = confirm.length > 0 && password !== confirm;
  const problem = policyError ?? (mismatch ? "Those passwords do not match." : null);
  const canSubmit = !passwordError(password) && password === confirm && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await apiFetch("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (user) setUser({ ...user, must_change_password: false });
      toast("Password updated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="hero">
        <h1 className="hero-title">Choose a <span className="accent">new password.</span></h1>
        <p className="hero-subtitle">
          Your current password was set by an administrator, so pick one only you know.
        </p>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="login-input-pill">
            <input
              className="text-input"
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="login-input-pill">
            <input
              className="text-input"
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </div>
          <span className={`modal-field-hint${problem ? " is-error" : ""}`}>
            {problem ?? PASSWORD_RULE}
          </span>
          <button className="button primary login-submit" type="submit" disabled={!canSubmit}>
            {busy ? "Saving…" : "Set password"}
          </button>
        </form>

        <button className="link-button" onClick={logout} style={{ marginTop: "1.5rem" }}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}
