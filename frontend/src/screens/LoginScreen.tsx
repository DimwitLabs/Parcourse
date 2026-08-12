import { useState } from "react";

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
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to continue your courses.</p>
        <input
          className="text-input boxed"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="text-input boxed"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}
