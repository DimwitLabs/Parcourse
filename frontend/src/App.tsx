import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type Stage = "loading" | "mode" | "signup" | "login" | "add-user" | "done";

export default function App() {
  const [stage, setStage] = useState<Stage>("loading");
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
  const [transcriptText, setTranscriptText] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [segments, setSegments] = useState<{ text: string; start: number; duration: number }[]>([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [guardrailResult, setGuardrailResult] = useState<string | null>(null);
  const [guardrailError, setGuardrailError] = useState<string | null>(null);
  type MCQ = { id: string; question: string; options: { label: string; text: string }[] };
  type TheoryQ = { id: string; question: string };
  type Section = {
    title: string;
    summary: string;
    start_seconds: number;
    end_seconds: number;
    mcqs: MCQ[];
    theory_questions: TheoryQ[];
  };
  const [course, setCourse] = useState<{
    id: string;
    thumbnail_url: string;
    sections: Section[];
  } | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<string | null>(null);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [sectionFrames, setSectionFrames] = useState<Record<number, string>>({});
  const [frameError, setFrameError] = useState<string | null>(null);

  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/setup-status`)
      .then((res) => res.json())
      .then((data) => setStage(data.needs_setup ? "mode" : "login"))
      .catch(() => setStage("mode"));
  }, []);

  async function login() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setToken(data.access_token);
      setStage("done");
    } catch (err) {
      setError(String(err));
    }
  }

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setTranscript(JSON.stringify(data, null, 2));
      setTranscriptText(data.segments.map((s: { text: string }) => s.text).join(" "));
      setVideoId(data.video_id);
      setSegments(data.segments);
    } catch (err) {
      setTranscriptError(String(err));
    }
  }

  async function generateCourse() {
    setCourseError(null);
    setCourse(null);
    try {
      const res = await fetch(`${API_BASE_URL}/course/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ video_id: videoId, segments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setCourse(data);
    } catch (err) {
      setCourseError(String(err));
    }
  }

  async function getStoryboard() {
    setStoryboardError(null);
    setStoryboard(null);
    try {
      const res = await fetch(`${API_BASE_URL}/storyboard/${videoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setStoryboard(JSON.stringify(data, null, 2));
    } catch (err) {
      setStoryboardError(String(err));
    }
  }

  async function loadSectionFrame(index: number, startSeconds: number) {
    setFrameError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/storyboard/${videoId}/frame?seconds=${startSeconds}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? JSON.stringify(data));
      }
      const blob = await res.blob();
      setSectionFrames((prev) => ({ ...prev, [index]: URL.createObjectURL(blob) }));
    } catch (err) {
      setFrameError(String(err));
    }
  }

  async function submitQuiz() {
    if (!course) return;
    setQuizError(null);
    setQuizResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/quiz/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_id: course.id,
          mcq_answers: Object.entries(mcqAnswers).map(([question_id, selected_label]) => ({
            question_id,
            selected_label,
          })),
          theory_answers: Object.entries(theoryAnswers).map(([question_id, answer_text]) => ({
            question_id,
            answer_text,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setQuizResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setQuizError(String(err));
    }
  }

  async function checkGuardrail() {
    setGuardrailError(null);
    setGuardrailResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/guardrail/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? JSON.stringify(data));
      setGuardrailResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setGuardrailError(String(err));
    }
  }

  return (
    <div>
      {stage === "loading" && <p>loading...</p>}

      {stage === "login" && (
        <div>
          <p>Log in</p>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={login}>log in</button>
        </div>
      )}

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

          <hr />

          <p>Paste a YouTube URL</p>
          <input
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <button onClick={getTranscript}>get transcript</button>
          {transcriptError && <p style={{ color: "red" }}>{transcriptError}</p>}
          {transcript && <pre>{transcript}</pre>}
          {transcriptText && <button onClick={checkGuardrail}>check guardrail</button>}
          {videoId && <button onClick={getStoryboard}>get storyboard</button>}
          {storyboardError && <p style={{ color: "red" }}>{storyboardError}</p>}
          {storyboard && <pre>{storyboard}</pre>}
          {guardrailError && <p style={{ color: "red" }}>{guardrailError}</p>}
          {guardrailResult && <pre>{guardrailResult}</pre>}
          {segments.length > 0 && <button onClick={generateCourse}>generate course</button>}
          {courseError && <p style={{ color: "red" }}>{courseError}</p>}
          {course && (
            <div>
              <img src={course.thumbnail_url} alt="thumbnail" width={320} />
              {frameError && <p style={{ color: "red" }}>{frameError}</p>}
              {course.sections.map((s, i) => (
                <div key={i}>
                  <h3>{s.title}</h3>
                  <p>{s.summary}</p>
                  <p>
                    {s.start_seconds}s - {s.end_seconds}s
                  </p>
                  {sectionFrames[i] ? (
                    <img src={sectionFrames[i]} alt={s.title} width={160} />
                  ) : (
                    <button onClick={() => loadSectionFrame(i, s.start_seconds)}>load frame</button>
                  )}

                  {s.mcqs.map((m) => (
                    <div key={m.id}>
                      <p>{m.question}</p>
                      {m.options.map((o) => (
                        <label key={o.label}>
                          <input
                            type="radio"
                            name={m.id}
                            checked={mcqAnswers[m.id] === o.label}
                            onChange={() => setMcqAnswers((prev) => ({ ...prev, [m.id]: o.label }))}
                          />
                          {o.label}. {o.text}
                        </label>
                      ))}
                    </div>
                  ))}

                  {s.theory_questions.map((t) => (
                    <div key={t.id}>
                      <p>{t.question}</p>
                      <textarea
                        value={theoryAnswers[t.id] ?? ""}
                        onChange={(e) =>
                          setTheoryAnswers((prev) => ({ ...prev, [t.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}

              <button onClick={submitQuiz}>submit quiz</button>
              {quizError && <p style={{ color: "red" }}>{quizError}</p>}
              {quizResult && <pre>{quizResult}</pre>}
            </div>
          )}
        </div>
      )}

      <pre>token: {token ?? "(none)"}</pre>
      <pre>error: {error ?? "(none)"}</pre>
    </div>
  );
}
