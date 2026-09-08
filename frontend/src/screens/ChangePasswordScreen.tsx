import { useState } from "react";

import PasswordChangeForm from "../components/PasswordChangeForm";
import ThemeSwitch from "../components/ThemeSwitch";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ChangePasswordScreen() {
  const { token, user, setUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function submit({ current, password }: { current: string; password: string }) {
    setBusy(true);
    try {
      await apiFetch("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({ password, current_password: current }),
      });
      if (user) setUser({ ...user, must_change_password: false, has_password: true });
      toast("Password updated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <ThemeSwitch className="login-theme-switch" />
      <div className="hero">
        <h1 className="hero-title">Choose a <span className="accent">new password.</span></h1>
        <p className="hero-subtitle">
          Your current password was set by an administrator, so pick one only you know.
        </p>

        <PasswordChangeForm
          requireCurrent
          className="login-form"
          buttonClassName="button primary login-submit"
          submitLabel="Set password"
          busy={busy}
          onSubmit={submit}
        />

        <button className="link-button" onClick={logout} style={{ marginTop: "1.5rem" }}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}
