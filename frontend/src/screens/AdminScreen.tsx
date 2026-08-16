import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Avatar from "../components/Avatar";
import PasswordField from "../components/PasswordField";
import { toast } from "../components/Toast";
import { apiFetch, errMsg } from "../lib/api";
import { generatePassword, passwordError } from "../lib/password";
import { useAuth } from "../lib/auth";
import { useEscapeKey } from "../lib/useEscapeKey";

type UserWithUsage = {
  id: string;
  email: string;
  role: "admin" | "student";
  created_at: string;
  course_count: number;
  first_name?: string;
  last_name?: string;
};

type ConfirmAction = { userId: string; action: "delete" | "reset" };

export default function AdminScreen() {
  const { token, user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithUsage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [busy, setBusy] = useState(false);

  useEscapeKey(showAdd, () => { if (!busy) setShowAdd(false); });

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [pwdUser, setPwdUser] = useState<UserWithUsage | null>(null);
  const [newUserPwd, setNewUserPwd] = useState("");

  useEscapeKey(!!pwdUser, () => { if (!actionBusy) setPwdUser(null); });

  useEffect(() => {
    setNewUserPwd(pwdUser ? generatePassword() : "");
  }, [pwdUser]);

  useEffect(() => {
    if (showAdd) setNewPassword(generatePassword());
  }, [showAdd]);

  async function resetPassword() {
    if (!pwdUser) return;
    setActionBusy(true);
    try {
      await apiFetch(`/users/${pwdUser.id}/reset-password`, token, {
        method: "POST",
        body: JSON.stringify({ password: newUserPwd }),
      });
      toast(`Password updated for ${pwdUser.email}`, "success");
      setPwdUser(null);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setActionBusy(false);
    }
  }

  function refresh() {
    apiFetch("/users", token)
      .then(setUsers)
      .catch((err) => setError(String(err.message ?? err)));
  }

  useEffect(refresh, [token]);

  async function addUser() {
    setBusy(true);
    try {
      await apiFetch("/users", token, {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          first_name: newFirstName || null,
          last_name: newLastName || null,
        }),
      });
      setNewEmail("");
      setNewPassword("");
      setNewFirstName("");
      setNewLastName("");
      setShowAdd(false);
      toast(`${newEmail} added`, "success");
      refresh();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string) {
    setActionBusy(true);
    try {
      await apiFetch(`/users/${userId}`, token, { method: "DELETE" });
      refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionBusy(false);
      setConfirm(null);
    }
  }

  async function resetProgress(userId: string) {
    setActionBusy(true);
    try {
      await apiFetch(`/users/${userId}/reset-progress`, token, { method: "POST" });
      refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionBusy(false);
      setConfirm(null);
    }
  }

  if (error) return <p className="error-message">{error}</p>;
  if (!users) return <p className="status-message">Loading users…</p>;

  const adminCount = users.filter((u) => u.role === "admin").length;
  const totalCourses = users.reduce((n, u) => n + u.course_count, 0);

  return (
    <div className="admin-view">
      <div className="admin-header">
        <div className="page-header">
          <h1 className="page-header-title">Users</h1>
          <p className="page-header-sub">Usage across everyone on this instance.</p>
        </div>
        <button className="button primary" onClick={() => setShowAdd((v) => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add user
        </button>
      </div>

      <div className="admin-kpi-row">
        <div className="admin-kpi card">
          <b>{users.length}</b>
          <span>Total users</span>
        </div>
        <div className="admin-kpi card">
          <b>{totalCourses}</b>
          <span>Courses generated</span>
        </div>
        <div className="admin-kpi card">
          <b>{adminCount}</b>
          <span>Admins</span>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 800 }}>Add user</h2>
            <div className="modal-form">
              <div className="modal-form-row">
                <input
                  className="text-input boxed"
                  placeholder="First name"
                  autoComplete="off"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                />
                <input
                  className="text-input boxed"
                  placeholder="Last name"
                  autoComplete="off"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                />
              </div>
              <input
                className="text-input boxed"
                placeholder="Email"
                type="email"
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                disabled={busy}
                hint="Name is optional. Share this password with the user, they will be asked to change it on first sign in."
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="button secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="button primary" onClick={addUser} disabled={busy || !newEmail || !!passwordError(newPassword)}>
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pwdUser && (
        <div className="modal-overlay" onClick={() => !actionBusy && setPwdUser(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 800 }}>Set new password</h2>
            <p style={{ margin: "0 0 1rem", color: "var(--color-ink-soft)" }}>
              Sets a new password for {pwdUser.email}. Their courses, progress and quiz history are untouched.
            </p>
            <PasswordField value={newUserPwd} onChange={setNewUserPwd} disabled={actionBusy} />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button className="button secondary" onClick={() => setPwdUser(null)} disabled={actionBusy}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={resetPassword}
                disabled={actionBusy || !!passwordError(newUserPwd)}
              >
                {actionBusy ? "Saving…" : "Set password"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card user-table">
        {users.map((u) => {
          const isConfirming = confirm?.userId === u.id;
          const isSelf = u.id === me?.id;
          return (
            <div className="user-row" key={u.id}>
              <Avatar user={u} size={80} className="user-avatar" />
              <div className="user-info">
                {u.first_name && <span className="user-row-name">{u.first_name} {u.last_name ?? ""}</span>}
                <span className="user-row-email">{u.email}</span>
                <span className={`role-pill${u.role === "admin" ? " admin" : ""}`}>
                  {u.role === "admin" ? "Admin" : "User"}
                </span>
              </div>
              <span className="user-row-courses">{u.course_count} courses</span>

              {isConfirming ? (
                <div className="confirm-bar">
                  <span className={`confirm-text${confirm.action === "delete" ? " danger" : ""}`}>
                    {confirm.action === "delete"
                      ? "Remove user and all their data?"
                      : "Delete all courses and quiz history?"}
                  </span>
                  <button
                    className={`icon-btn${confirm.action === "delete" ? " danger" : " primary"}`}
                    onClick={() =>
                      confirm.action === "delete" ? deleteUser(u.id) : resetProgress(u.id)
                    }
                    disabled={actionBusy}
                    title="Confirm"
                  >
                    {actionBusy ? "…" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                  <button className="icon-btn" onClick={() => setConfirm(null)} title="Cancel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <div className="user-row-actions">
                  <button className="icon-btn" onClick={() => navigate(`/graph?user=${u.id}`)} title="Knowledge graph">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="8" y1="7.5" x2="16" y2="16.5"/></svg>
                  </button>
                  <button className="icon-btn" onClick={() => setPwdUser(u)} title="Set new password">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                  {!isSelf && (
                    <>
                      <button
                        className="icon-btn"
                        onClick={() => setConfirm({ userId: u.id, action: "reset" })}
                        title="Reset progress"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l9.5-9.5L20 14v6z"/><line x1="14.5" y1="4.5" x2="19.5" y2="9.5"/><line x1="12" y1="7" x2="17" y2="12"/></svg>
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => setConfirm({ userId: u.id, action: "delete" })}
                        title="Remove user"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
