import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import CustomSelect from "../components/CustomSelect";
import { apiFetch, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";

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
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [currentModel, setCurrentModel] = useState("");
  const [modelSaving, setModelSaving] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  function refresh() {
    apiFetch("/users", token)
      .then(setUsers)
      .catch((err) => setError(String(err.message ?? err)));
  }

  useEffect(refresh, [token]);

  useEffect(() => {
    apiFetch("/settings/model", token)
      .then((data: { model: string }) => setCurrentModel(data.model))
      .catch(() => {});
  }, [token]);

  async function saveModel(model: string) {
    setModelSaving(true);
    try {
      const data = await apiFetch("/settings/model", token, {
        method: "PUT",
        body: JSON.stringify({ model }),
      });
      setCurrentModel(data.model);
    } catch {
    } finally {
      setModelSaving(false);
    }
  }

  async function addUser() {
    setAddError(null);
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
      refresh();
    } catch (err) {
      setAddError(errMsg(err));
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <input
                className="text-input boxed"
                placeholder="First name"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <input
                className="text-input boxed"
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <input
              className="text-input boxed"
              placeholder="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <input
              className="text-input boxed"
              placeholder="password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="button primary" onClick={addUser} disabled={busy}>
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
            {addError && <p className="error-message">{addError}</p>}
          </div>
        </div>
      )}

      <div className="card admin-model-section">
        <div className="page-header">
          <h2 className="page-header-title" style={{ fontSize: "1.15rem" }}>AI Model</h2>
          <p className="page-header-sub">
            The model used for course generation, grading, and knowledge graph extraction.
          </p>
        </div>
        <div className="admin-model-row">
          <CustomSelect
            value={currentModel}
            disabled={modelSaving}
            onChange={(v) => { setCurrentModel(v); saveModel(v); }}
            options={[
              { value: "openrouter/openai/gpt-4o-mini", label: "GPT-4o Mini" },
              { value: "openrouter/openai/gpt-4o", label: "GPT-4o" },
              { value: "openrouter/openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
              { value: "openrouter/openai/gpt-4.1", label: "GPT-4.1" },
              { value: "openrouter/anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
              { value: "openrouter/anthropic/claude-haiku-4", label: "Claude Haiku 4" },
              { value: "openrouter/google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
              { value: "openrouter/google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
            ]}
          />
          {modelSaving && <span className="status-message" style={{ margin: 0 }}>Saving…</span>}
        </div>
      </div>

      <div className="card user-table">
        {users.map((u) => {
          const isConfirming = confirm?.userId === u.id;
          const isSelf = u.id === me?.id;
          return (
            <div className="user-row" key={u.id}>
              <div className="user-avatar">{(u.first_name ? u.first_name[0] + (u.last_name?.[0] ?? "") : u.email.slice(0, 2)).toUpperCase()}</div>
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
