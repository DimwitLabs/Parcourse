import { useEffect, useState } from "react";

import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "api-key" | "account";

export default function SettingsScreen() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("api-key");

  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);

  const [hasInstanceKey, setHasInstanceKey] = useState(false);
  const [instanceInput, setInstanceInput] = useState("");
  const [instanceSaving, setInstanceSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    apiFetch("/settings/api-key", token)
      .then((d: { has_key: boolean }) => setHasKey(d.has_key))
      .catch(() => {});
    if (user?.role === "admin") {
      apiFetch("/settings/instance-key", token)
        .then((d: { has_key: boolean }) => setHasInstanceKey(d.has_key))
        .catch(() => {});
    }
    apiFetch("/auth/me", token)
      .then((d: { first_name?: string; last_name?: string }) => {
        setFirstName(d.first_name ?? "");
        setLastName(d.last_name ?? "");
      })
      .catch(() => {});
  }, [token, user?.role]);

  async function saveKey() {
    setKeySaving(true);
    try {
      const d = await apiFetch("/settings/api-key", token, {
        method: "PUT",
        body: JSON.stringify({ api_key: keyInput }),
      });
      setHasKey(d.has_key);
      setKeyInput("");
      toast(d.has_key ? "Key saved" : "Key cleared", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setKeySaving(false);
    }
  }

  async function saveInstanceKey() {
    setInstanceSaving(true);
    try {
      const d = await apiFetch("/settings/instance-key", token, {
        method: "PUT",
        body: JSON.stringify({ api_key: instanceInput }),
      });
      setHasInstanceKey(d.has_key);
      setInstanceInput("");
      toast(d.has_key ? "Instance key saved" : "Instance key cleared", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setInstanceSaving(false);
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
            <>
              {user?.role === "admin" ? (
                <div className="card settings-section">
                  <h2 className="settings-section-title">Instance API Key</h2>
                  <p className="settings-section-desc">
                    Used for all course generation, grading, and analysis. Users without their own key fall back to this.
                  </p>
                  <p className="status-message" style={{ margin: 0, textAlign: "left" }}>
                    Status: {hasInstanceKey ? "Key is set" : "No key"}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="text-input boxed"
                      placeholder="sk-or-…"
                      value={instanceInput}
                      onChange={(e) => setInstanceInput(e.target.value)}
                      style={{ flex: 1, marginBottom: 0 }}
                    />
                    <button className="button primary" onClick={saveInstanceKey} disabled={instanceSaving}>
                      {instanceSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card settings-section">
                  <h2 className="settings-section-title">Your API Key</h2>
                  <p className="settings-section-desc">
                    Bring your own OpenRouter key. This overrides the instance default.
                  </p>
                  <p className="status-message" style={{ margin: 0, textAlign: "left" }}>
                    Status: {hasKey ? "Key is set" : "No key"}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="text-input boxed"
                      placeholder="sk-or-…"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      style={{ flex: 1, marginBottom: 0 }}
                    />
                    <button className="button primary" onClick={saveKey} disabled={keySaving}>
                      {keySaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </>
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
