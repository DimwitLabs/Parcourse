import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import LearningStyleIcon from "../components/LearningStyleIcon";
import PasswordChangeForm from "../components/PasswordChangeForm";
import ProviderForm from "../components/ProviderForm";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LEARNING_STYLES, styleOf } from "../lib/learningStyle";
import type { LearningStyle } from "../lib/learningStyle";
import { passwordsAllowed, useSso } from "../lib/sso";

type Tab = "learning-style" | "api-key" | "account";

const TABS: Tab[] = ["learning-style", "api-key", "account"];

export default function SettingsScreen() {
  const { token, user, setUser } = useAuth();
  const [params] = useSearchParams();
  const asked = params.get("tab") as Tab;
  const [tab, setTab] = useState<Tab>(TABS.includes(asked) ? asked : "learning-style");
  const [styleSaving, setStyleSaving] = useState(false);
  const [pickedStyle, setPickedStyle] = useState<LearningStyle | null>(null);
  const savedStyle = user?.learning_style ?? "explorer";
  const shownStyle = pickedStyle ?? savedStyle;
  const shownDetails = styleOf(shownStyle);

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

  async function saveLearningStyle() {
    if (!user) return;
    setStyleSaving(true);
    try {
      await apiFetch("/settings/learning-style", token, {
        method: "PUT",
        body: JSON.stringify({ learning_style: shownStyle }),
      });
      setUser({ ...user, learning_style: shownStyle });
      setPickedStyle(null);
      toast("Learning style saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setStyleSaving(false);
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
          <button className={tab === "learning-style" ? "active" : ""} onClick={() => setTab("learning-style")}>
            Learning Style
          </button>
          <button className={tab === "api-key" ? "active" : ""} onClick={() => setTab("api-key")}>
            AI Provider
          </button>
          <button className={tab === "account" ? "active" : ""} onClick={() => setTab("account")}>
            Account
          </button>
        </div>

        <div className="settings-pane">
          {tab === "learning-style" && (
            <div className="card settings-section">
              <h2 className="settings-section-title">Learning Style</h2>
              <p className="settings-section-desc">
                Not all of us learn the same way. Your learning style sets the kind of questions each course asks you, and
                how much they challenge you. You can also change each course individually after generation if something
                doesn't feel right while you learn it.
              </p>
              <div className="style-tiles" role="radiogroup" aria-label="Learning style">
                {LEARNING_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    role="radio"
                    aria-checked={shownStyle === style.value}
                    className={`style-tile${shownStyle === style.value ? " selected" : ""}`}
                    onClick={() => setPickedStyle(style.value)}
                    disabled={styleSaving}
                  >
                    <LearningStyleIcon style={style.value} size={22} />
                    <span>{style.name}</span>
                  </button>
                ))}
              </div>
              <div className="style-detail">
                <LearningStyleIcon style={shownDetails.value} size={18} />
                <p>{shownDetails.description}</p>
              </div>
              <button
                className="button primary login-submit"
                onClick={saveLearningStyle}
                disabled={styleSaving || shownStyle === savedStyle}
              >
                {styleSaving
                  ? "Saving…"
                  : shownStyle === savedStyle
                    ? `You're ${shownDetails.identity}`
                    : `You'll be ${shownDetails.identity}`}
              </button>
            </div>
          )}

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
