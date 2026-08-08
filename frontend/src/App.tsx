import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type Stage = "mode" | "signup" | "add-user" | "done";

export default function App() {
  const [stage, setStage] = useState<Stage>("mode");
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  async function signup() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setToken(data.access_token);
      setStage(mode === "multi" ? "add-user" : "done");
    } catch (err) {
      setError(String(err));
    }
  }

  async function addUser() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setStage("done");
    } catch (err) {
      setError(String(err));
    }
  }

  async function fetchMe() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setMe(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(String(err));
    }
  }

  async function getTranscript() {
    setTranscriptError(null);
    setTranscript(null);
    try {
      const res = await fetch(`${API_BASE_URL}/transcript/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setTranscript(JSON.stringify(data, null, 2));
    } catch (err) {
      setTranscriptError(String(err));
    }
  }

  return (
    <div>
      <div>
        <p>Paste a YouTube URL</p>
        <input
          placeholder="https://www.youtube.com/watch?v=..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button onClick={getTranscript}>get transcript</button>
        {transcriptError && <p style={{ color: "red" }}>{transcriptError}</p>}
        {transcript && <pre>{transcript}</pre>}
      </div>

      <hr />

      {stage === "mode" && (
        <div>
          <p>Single user, or multiple people using this?</p>
          <label>
            <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} />
            single
          </label>
          <label>
            <input type="radio" checked={mode === "multi"} onChange={() => setMode("multi")} />
            multi
          </label>
          <button onClick={() => setStage("signup")}>next</button>
        </div>
      )}

      {stage === "signup" && (
        <div>
          <p>Create your account ({mode})</p>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={signup}>sign up</button>
        </div>
      )}

      {stage === "add-user" && (
        <div>
          <p>Add another user now, or do it later?</p>
          <input
            placeholder="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          <input
            placeholder="password"
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
          />
          <button onClick={addUser}>add user</button>
          <button onClick={() => setStage("done")}>later</button>
        </div>
      )}

      {stage === "done" && (
        <div>
          <p>done.</p>
          <button onClick={fetchMe}>/auth/me</button>
          <pre>{me ?? "(none)"}</pre>
        </div>
      )}

      <pre>token: {token ?? "(none)"}</pre>
      <pre>error: {error ?? "(none)"}</pre>
    </div>
  );
}
