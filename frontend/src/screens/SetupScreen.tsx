import { useState } from "react";

import CanvasBackground from "../components/CanvasBackground";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

type Stage = "mode" | "signup" | "api-key" | "add-user";

export default function SetupScreen() {
  const { setSession } = useAuth();
  const [stage, setStage] = useState<Stage>("mode");
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [addedUsers, setAddedUsers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; role: "admin" | "student" } | null>(null);

  async function signup() {
    setBusy(true);
    try {
      const data = await apiFetch("/auth/setup", null, {
        method: "POST",
        body: JSON.stringify({ email, password, mode }),
      });
      const me = await apiFetch("/auth/me", data.access_token);
      setPendingToken(data.access_token);
      setPendingUser(me);
      setStage("api-key");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveInstanceKey() {
    if (!pendingToken || !apiKey.trim()) {
      goAfterKey();
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/settings/instance-key", pendingToken, {
        method: "PUT",
        body: JSON.stringify({ api_key: apiKey }),
      });
      goAfterKey();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function goAfterKey() {
    if (mode === "multi") {
      setStage("add-user");
    } else {
      finishSetup();
    }
  }

  async function addUser() {
    if (!pendingToken) return;
    setBusy(true);
    try {
      await apiFetch("/users", pendingToken, {
        method: "POST",
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword }),
      });
      toast(`${newUserEmail} added`, "success");
      setAddedUsers((prev) => [...prev, newUserEmail]);
      setNewUserEmail("");
      setNewUserPassword("");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function finishSetup() {
    if (pendingToken && pendingUser) setSession(pendingToken, pendingUser);
  }

  return (
    <div className="login-page">
      <CanvasBackground />

      <div className="login-brand">
        <img src="/parcourse-wordmark.svg" alt="Parcourse" height="44" />
      </div>

      {stage === "mode" && (
        <div className="hero" style={{ padding: 0 }}>
          <h1 className="hero-title">Let's set up <span className="accent">Parcourse.</span></h1>
          <p className="hero-subtitle">Will you be learning solo, or bringing a team?</p>
          <div className="login-form">
            <label className={`setup-radio-pill${mode === "single" ? " selected" : ""}`}>
              <input type="radio" name="mode" checked={mode === "single"} onChange={() => setMode("single")} />
              <span className="setup-radio-text">
                <strong>Just me</strong>
                <span>Single-user instance</span>
              </span>
            </label>
            <label className={`setup-radio-pill${mode === "multi" ? " selected" : ""}`}>
              <input type="radio" name="mode" checked={mode === "multi"} onChange={() => setMode("multi")} />
              <span className="setup-radio-text">
                <strong>Multiple people</strong>
                <span>Admin + learners</span>
              </span>
            </label>
            <button className="button primary login-submit" onClick={() => setStage("signup")}>
              Continue
            </button>
          </div>
        </div>
      )}

      {stage === "signup" && (
        <div className="hero" style={{ padding: 0 }}>
          <h1 className="hero-title">Create your <span className="accent">account.</span></h1>
          <p className="hero-subtitle">
            {mode === "multi" ? "You'll be the admin. You can invite others once you're in." : "One account, all yours."}
          </p>
          <form className="login-form" onSubmit={(e) => { e.preventDefault(); signup(); }}>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <button className="button primary login-submit" type="submit" disabled={busy || !email || !password}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>
      )}

      {stage === "api-key" && (
        <div className="hero" style={{ padding: 0 }}>
          <h1 className="hero-title">Add your <span className="accent">AI key.</span></h1>
          <p className="hero-subtitle">
            Your OpenRouter key powers course generation, quizzes, and analysis. You can add it later in settings.
          </p>
          <div className="login-form">
            <div className="login-input-pill">
              <input
                className="text-input"
                placeholder="sk-or-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={busy}
              />
            </div>
            <button
              className="button primary login-submit"
              onClick={saveInstanceKey}
              disabled={busy || !apiKey.trim()}
            >
              {busy ? "Saving…" : "Save & continue"}
            </button>
            <button className="button secondary login-submit" onClick={goAfterKey} style={{ marginTop: 0 }}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {stage === "add-user" && (
        <div className="hero" style={{ padding: 0 }}>
          <h1 className="hero-title">Add <span className="accent">learners.</span></h1>
          <p className="hero-subtitle">Give people access now, or do it from the admin panel later.</p>
          <div className="login-form">
            {addedUsers.length > 0 && (
              <div className="setup-added-list">
                {addedUsers.map((u) => (
                  <span key={u} className="setup-added-pill">{u}</span>
                ))}
              </div>
            )}
            <div className="login-input-pill">
              <input
                className="text-input"
                placeholder="email"
                type="email"
                autoComplete="off"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="login-input-pill">
              <input
                className="text-input"
                placeholder="password"
                type="password"
                autoComplete="new-password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <button
              className="button primary login-submit"
              onClick={addUser}
              disabled={busy || !newUserEmail || !newUserPassword}
            >
              {busy ? "Adding…" : "Add user"}
            </button>
            <button className="button secondary login-submit" onClick={finishSetup} style={{ marginTop: 0 }}>
              {addedUsers.length > 0 ? "Done" : "I'll do it later"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
