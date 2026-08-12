import { useState } from "react";

import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

type Stage = "mode" | "signup" | "add-user";

export default function SetupScreen() {
  const { setSession } = useAuth();
  const [stage, setStage] = useState<Stage>("mode");
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; role: "admin" | "student" } | null>(
    null,
  );

  async function signup() {
    setError(null);
    setBusy(true);
    try {
      const data = await apiFetch("/auth/setup", null, {
        method: "POST",
        body: JSON.stringify({ email, password, mode }),
      });

      const me = await apiFetch("/auth/me", data.access_token);

      if (mode === "multi") {
        setPendingToken(data.access_token);
        setPendingUser(me);
        setStage("add-user");
      } else {
        setSession(data.access_token, me);
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function addUser() {
    if (!pendingToken) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/users", pendingToken, {
        method: "POST",
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword }),
      });
      finishSetup();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function finishSetup() {
    if (pendingToken && pendingUser) setSession(pendingToken, pendingUser);
  }

  return (
    <div className="auth-page">
      {stage === "mode" && (
        <div className="card auth-card">
          <h1 className="auth-title">Let's set up Parcourse</h1>
          <p className="auth-subtitle">Will this be used by one person, or a group?</p>
          <label className="radio-row">
            <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} />
            Just me
          </label>
          <label className="radio-row">
            <input type="radio" checked={mode === "multi"} onChange={() => setMode("multi")} />
            Multiple people
          </label>
          <button className="button primary" onClick={() => setStage("signup")}>
            Continue
          </button>
        </div>
      )}

      {stage === "signup" && (
        <form
          className="card auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            signup();
          }}
        >
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">You'll be the {mode === "multi" ? "admin" : "only user"}.</p>
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
            {busy ? "Creating…" : "Sign up"}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      )}

      {stage === "add-user" && (
        <div className="card auth-card">
          <h1 className="auth-title">Add another user?</h1>
          <p className="auth-subtitle">You can always do this later from the admin panel.</p>
          <input
            className="text-input boxed"
            placeholder="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          <input
            className="text-input boxed"
            placeholder="password"
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
          />
          <div className="button-row">
            <button className="button primary" onClick={addUser} disabled={busy}>
              Add user
            </button>
            <button className="button secondary" onClick={finishSetup}>
              I'll do it later
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </div>
  );
}
