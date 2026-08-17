# Architecture

React (Vite/TS) → FastAPI → PostgreSQL. Three containers, one `docker compose up`. AI calls go through LiteLLM, so any provider it reaches — GPT, Claude, Gemini, OpenRouter, or a local Ollama — is a dropdown away, the point being you can run the whole thing on your own hardware.

**Pipeline:** transcript (YouTube captions, via `youtube-transcript-api`) → guardrail check that it's actually educational → AI splits it into sections → generates MCQs and theory questions → MCQs scored by match, theory scored by AI against a reference answer. The finished course is cached as JSON so it's generated once and replayed cheaply.

**Data:** `User` (admin/student, JWT + bcrypt) owns `CachedCourse`, `QuizAttempt` and section progress. Knowledge graph nodes and edges are shared across the instance and deduplicated by label; mastery lives in `UserKnowledgeProgress`, per user. Two students studying the same topic share the concept, not the score. Deleting a course with graph cleanup drops a concept only when no other course of yours still reaches it.

**Connections:** provider, model and credentials are one encrypted JSON blob per row, so a provider needing three AWS fields costs no schema change. The provider list is generated from `litellm.provider_list`; only curated labels and suggested models are hand-written. A user's own connection beats the instance default, and credentials are never read from the environment so they can be rotated without a redeploy. JSON output degrades in three tiers — response schema, then `json_object`, then prompt-only — chosen per model, because support varies by model rather than by provider.

**Decisions worth knowing:** every AI response is parsed through Pydantic, so malformed output fails loudly instead of corrupting data. Knowledge graph writes are best-effort — a graph failure never blocks scoring. Students get `CourseResponsePublic`, a schema with no `correct_label` or `reference_answer`, so answers can't be read out of the API. The schema is created from the SQLModel definitions at startup; there is no migration tool yet, which is fine while nothing is deployed and is the first thing to add when something is.

**Gaps:** course generation is synchronous — a long video blocks the request, and a job queue is the obvious fix. There are no migrations, so any schema change today means recreating the database.
