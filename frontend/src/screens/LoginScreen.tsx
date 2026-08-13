import { useState } from "react";

import CanvasBackground from "../components/CanvasBackground";
import { errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <CanvasBackground />

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
              placeholder="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="login-input-pill">
            <input
              className="text-input"
              placeholder="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <button className="button primary login-submit" type="submit" disabled={busy || !email || !password}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          {error && <p className="error-message" style={{ margin: "0.25rem 0 0", textAlign: "center" }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
