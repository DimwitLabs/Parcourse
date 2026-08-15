import { useEffect, useState } from "react";

import ProviderForm from "../components/ProviderForm";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "api-key" | "account";

export default function SettingsScreen() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("api-key");

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
            <div className="card settings-section">
              {user?.role === "admin" ? (
                <>
                  <h2 className="settings-section-title">Instance connection</h2>
                  <p className="settings-section-desc">
                    Used for course generation, grading and analysis. Users without their own connection fall back to this.
                  </p>
                  <ProviderForm scope="instance" />
                </>
              ) : (
                <>
                  <h2 className="settings-section-title">Your AI provider</h2>
                  <p className="settings-section-desc">
                    Bring your own provider and key. This overrides the instance default.
                  </p>
                  <ProviderForm scope="user" />
                </>
              )}
            </div>
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
