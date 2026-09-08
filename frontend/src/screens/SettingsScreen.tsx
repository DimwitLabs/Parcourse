import { useEffect, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import ProviderForm from "../components/ProviderForm";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PASSWORD_RULE, passwordError } from "../lib/password";

type Tab = "api-key" | "account";

export default function SettingsScreen() {
  const { token, user, setUser } = useAuth();
  const [tab, setTab] = useState<Tab>("api-key");

  const hasPassword = user?.has_password !== false;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    apiFetch("/auth/me", token)
      .then((d: { first_name?: string; last_name?: string }) => {
        setFirstName(d.first_name ?? "");
        setLastName(d.last_name ?? "");
      })
      .catch(() => {});
  }, [token, user?.role]);

  const policyProblem = newPassword.length > 0 ? passwordError(newPassword) : null;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordProblem = policyProblem ?? (mismatch ? "Those passwords do not match." : null);
  const canSavePassword =
    passwordError(newPassword) === null &&
    newPassword === confirmPassword &&
    (hasPassword ? currentPassword.length > 0 : true) &&
    passwordSaving === false;

  async function savePassword() {
    if (canSavePassword === false) return;
    setPasswordSaving(true);
    try {
      await apiFetch("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({
          password: newPassword,
          current_password: hasPassword ? currentPassword : null,
        }),
      });
      if (user) setUser({ ...user, has_password: true, must_change_password: false });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast(hasPassword ? "Password changed" : "Password set", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    try {
      await apiFetch("/settings/profile", token, {
        method: "PUT",
        body: JSON.stringify({ first_name: firstName || null, last_name: lastName || null }),
      });
      toast("Profile saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="settings-view">
      <div className="page-header">
        <h1 className="page-header-title">Settings</h1>
        <p className="page-header-sub">Manage your account and API configuration.</p>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <button className={tab === "api-key" ? "active" : ""} onClick={() => setTab("api-key")}>
            AI Provider
          </button>
          <button className={tab === "account" ? "active" : ""} onClick={() => setTab("account")}>
            Account
          </button>
        </div>

        <div className="settings-pane">
          {tab === "api-key" && (
            <ProviderForm scope={user?.role === "admin" ? "instance" : "user"} />
          )}

          {tab === "account" && (
            <>
              <div className="card settings-section">
                <h2 className="settings-section-title">Profile</h2>
                <p className="settings-section-desc">
                  Your name is used to personalise AI feedback throughout the app.
                </p>
                <div className="profile-row">
                  <input
                    className="text-input boxed"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <input
                    className="text-input boxed"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  <button className="button primary" onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="card settings-section">
                <h2 className="settings-section-title">
                  {hasPassword ? "Change Password" : "Set a Password"}
                </h2>
                <p className="settings-section-desc">
                  {hasPassword
                    ? "You will stay signed in on this device."
                    : "You sign in through your provider. Setting a password gives you a second way in, for when the provider is unavailable."}
                </p>
                <form
                  className="password-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePassword();
                  }}
                >
                  {hasPassword && (
                    <PasswordInput
                      placeholder="Current password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      disabled={passwordSaving}
                      boxed
                    />
                  )}
                  <PasswordInput
                    placeholder="New password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    disabled={passwordSaving}
                    boxed
                  />
                  <PasswordInput
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    disabled={passwordSaving}
                    boxed
                  />
                  <span className={`modal-field-hint${passwordProblem ? " is-error" : ""}`}>
                    {passwordProblem ?? PASSWORD_RULE}
                  </span>
                  <button className="button primary" type="submit" disabled={canSavePassword === false}>
                    {passwordSaving ? "Saving…" : hasPassword ? "Change password" : "Set password"}
                  </button>
                </form>
              </div>

              <div className="card settings-section">
                <h2 className="settings-section-title">Account Details</h2>
                <p style={{ margin: 0 }}>
                  <b>Email:</b> {user?.email}
                </p>
                <p style={{ margin: "0.5rem 0 0" }}>
                  <b>Role:</b>{" "}
                  <span className={`role-pill${user?.role === "admin" ? " admin" : ""}`}>
                    {user?.role === "admin" ? "Admin" : "User"}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
