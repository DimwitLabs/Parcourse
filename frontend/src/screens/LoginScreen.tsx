import { useState } from "react";

import CanvasBackground from "../components/CanvasBackground";
import PasswordInput from "../components/PasswordInput";
import ThemeSwitch from "../components/ThemeSwitch";
import { toast } from "../components/Toast";
import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <CanvasBackground />
      <ThemeSwitch className="login-theme-switch" />

      <div className="login-brand">
        <img src="/parcourse-wordmark.svg" alt="Parcourse" height="44" />
      </div>

      <div className="hero" style={{ padding: "0", marginBottom: "0" }}>
        <h1 className="hero-title">Welcome <span className="accent">back.</span></h1>
        <p className="hero-subtitle">
          Your courses are waiting. All learning begins with a simple question.
        </p>

        <form className="login-form" onSubmit={submit}>
          <div className="login-input-pill">
            <input
              className="text-input"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <PasswordInput
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            disabled={busy}
          />
          <button className="button primary login-submit" type="submit" disabled={busy || !email || !password}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
