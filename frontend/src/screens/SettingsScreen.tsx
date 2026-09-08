import { useEffect, useState } from "react";

import PasswordChangeForm from "../components/PasswordChangeForm";
import ProviderForm from "../components/ProviderForm";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { passwordsAllowed, useSso } from "../lib/sso";

type Tab = "api-key" | "account";

export default function SettingsScreen() {
  const { token, user, setUser } = useAuth();
  const [tab, setTab] = useState<Tab>("api-key");

  const sso = useSso();
  const canSetPassword = passwordsAllowed(sso);
  const hasPassword = user?.has_password !== false;
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

  async function savePassword({ current, password }: { current: string; password: string }) {
    setPasswordSaving(true);
    try {
      await apiFetch("/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({
          password,
          current_password: hasPassword ? current : null,
        }),
      });
      if (user) setUser({ ...user, has_password: true, must_change_password: false });
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

              {canSetPassword && (
                <div className="card settings-section">
                  <h2 className="settings-section-title">
                    {hasPassword ? "Change Password" : "Set a Password"}
                  </h2>
                  <p className="settings-section-desc">
                    {hasPassword
                      ? "You will stay signed in on this device."
                      : "You sign in through your provider. Setting a password gives you a second way in, for when the provider is unavailable."}
                  </p>
                  <PasswordChangeForm
                    requireCurrent={hasPassword}
                    boxed
                    className="password-form"
                    buttonClassName="button primary"
                    submitLabel={hasPassword ? "Change password" : "Set password"}
                    busy={passwordSaving}
                    onSubmit={savePassword}
                  />
                </div>
              )}

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
