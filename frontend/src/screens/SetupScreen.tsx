import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PasswordField from "../components/PasswordField";
import PasswordInput from "../components/PasswordInput";
import ProviderForm from "../components/ProviderForm";
import ThemeSwitch from "../components/ThemeSwitch";
import { toast } from "../components/Toast";
import { PASSWORD_RULE, generatePassword, passwordError } from "../lib/password";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { passwordsAllowed, providerEnabled, providerName, ssoSettled, useSso } from "../lib/sso";

type Stage = "mode" | "signup" | "api-key" | "add-user";

export default function SetupScreen() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("mode");
  const sso = useSso();
  const settled = ssoSettled(sso);
  // The admin's own account follows OIDC_ONLY. Everyone they add afterwards
  // follows whether a provider exists at all, which is what the admin screen
  // does, so the two places create the same kind of account.
  const adminSetsPassword = passwordsAllowed(sso);
  const learnersSignInWithProvider = providerEnabled(sso);

  useEffect(() => {
    if (stage === "add-user" && learnersSignInWithProvider === false) setNewUserPassword(generatePassword());
  }, [stage, learnersSignInWithProvider]);
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password: adminSetsPassword ? password : null, mode }),
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
        body: JSON.stringify({
          email: newUserEmail,
          password: learnersSignInWithProvider ? null : newUserPassword,
        }),
      });
      toast(`${newUserEmail} added`, "success");
      setAddedUsers((prev) => [...prev, newUserEmail]);
      setNewUserEmail("");
      setNewUserPassword(generatePassword());
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function finishSetup() {
    if (!pendingToken || !pendingUser) return;
    // Setup renders over whatever URL the browser was on, so land on home
    // rather than whichever route that happened to be.
    navigate("/", { replace: true });
    setSession(pendingToken, pendingUser);
  }

  return (
    <div className="login-page">
      <ThemeSwitch className="login-theme-switch" />

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
                <span>Single-user for now</span>
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
                placeholder="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            {adminSetsPassword && (
              <>
                <PasswordInput
                  placeholder="Password"
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  disabled={busy}
                />
                <span className="modal-field-hint">{PASSWORD_RULE}</span>
              </>
            )}
            {settled && adminSetsPassword === false && (
              <span className="modal-field-hint">
                You will sign in through {providerName(sso)}, so there is no password to choose.
              </span>
            )}
            <button
              className="button primary login-submit"
              type="submit"
              disabled={
                busy ||
                settled === false ||
                !email ||
                (adminSetsPassword && passwordError(password) !== null)
              }
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>
      )}

      {stage === "api-key" && (
        <div className="hero" style={{ padding: 0 }}>
          <h1 className="hero-title">Connect your <span className="accent">AI provider.</span></h1>
          <p className="hero-subtitle">
            This powers course generation, quizzes and analysis. You can add it later in settings.
          </p>
          <div className="login-form">
            <ProviderForm
              scope="instance"
              onSaved={goAfterKey}
              onSkip={goAfterKey}
              authToken={pendingToken}
              framed={false}
            />
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
                placeholder="Email"
                type="email"
                autoComplete="off"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            {settled && learnersSignInWithProvider === false && (
              <PasswordField
                value={newUserPassword}
                onChange={setNewUserPassword}
                disabled={busy}
              />
            )}
            {learnersSignInWithProvider && (
              <span className="modal-field-hint">
                They sign in through {providerName(sso)}, so there is no password to hand out.
              </span>
            )}
            <button
              className="button primary login-submit"
              onClick={addUser}
              disabled={
                busy ||
                settled === false ||
                !newUserEmail ||
                (learnersSignInWithProvider === false && passwordError(newUserPassword) !== null)
              }
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
