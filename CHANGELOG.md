# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-08-19

### Added

- **Quiz History Improvements:** Every attempt at a quiz is kept and can be opened again. A course that has been attempted carries a history icon beside regenerate and delete, on the course page and on its notebook card, leading to a list of attempts newest first: each with its score, its number, and the attempt that first earned mastery flagged.
- **Prettier Quiz Results:** Animations! The score ring fills, a tick lands, and the course is done: no separate button to remember if you achieve the criteria.
- **Added Version Pill:** The profile menu carries the version the instance is running and links to that release on GitHub, so a deployment can be placed against this changelog without opening a shell.

### Fixed

- **Knowledge Graph:** Making a course no longer paints its concepts as studied. A node stays new until something has actually been scored against it.
- **Scores:** A half mark now reads as the rounded score it is graded against, marked with an asterisk, so the ring and the number in it agree.
- **Admin Area:** The admin is listed apart from the people using the instance, and the Admins count, which could only ever be one, is gone.  
- **Mobile Fixes:** The description under a heading sits below it rather than beside it, admin rows keep their controls inside the card, and the course actions stay reachable on a screen too narrow for the sidebar.
- **Landing Page:** The email field carries its own frame once the form stacks, the copy is centred rather than justified, and type comes down a step to match the heading.

## [1.0.1] - 2026-08-18

### Changed

- **Transcription:** Transcripts are fetched with `yt-dlp`, which is a more robust library and works significantly better across different hosts. A transcript is stored against its video, so we only fetch a video once in the entire lifetime of a deployment.
- **Proxy Support:** YouTube refuses transcript requests from the addresses rented servers have, so a deployment on one fetches through a proxy named by `YTDLP_PROXY`, or through the VPN that `docker-compose.ghcr-vpn.yml` runs beside it. A home machine needs none of it so can use the standard `docker-compose.yml`.
- Passwords are hashed with `bcrypt` directly, dropping the unmaintained `passlib` wrapper. Existing passwords keep working, and a password longer than bcrypt can read is now refused when it is set rather than silently truncated.

### Fixed

- **Logging:** `LOG_LEVEL` sets how much the backend says for itself, from `debug` to `critical`, defaulting to `info`.
- A password can be revealed while signing in, setting the instance up, or changing it, instead of being typed blind.
- Video titles keep the capitalisation YouTube gave them, instead of being title-cased into `Dna Explained`.

## [1.0.0] - 2026-08-17

### Added

- **Course Generation:** Transcript extraction, a guardrail check that the video is actually educational, then AI-generated sections, summaries, multiple-choice and theory questions.
- **Quiz Scoring:** Multiple choice is scored by match; theory answers are graded by the AI against a reference answer across accuracy, completeness and relevance, with written feedback.
- **Knowledge Graph:** Concepts are extracted per course into fields, topics and skills, deduplicated by label across the instance, with mastery tracked per user.
- **Quality-of-Life:** Course regeneration is supported with feedback from the user for videos. The platform also detects if something is not a course and flags it during generation itself.
- **Provider-agnostic:** Pick one from a dropdown and the form adapts to the fields it needs, from a single API key to a local Ollama URL or three AWS fields. Model suggestions are offered per provider, and any model ID is accepted. Note that not all models are tested and if you face any problems, please raise an [issue](https://github.com/DimwitLabs/Parcourse/issues).
- **Multi-user System:** The admin can set a system-level AI configuration and invite more users. The admin gets a generated password that they can edit and share with the users if they want. The user can then set their own password. If the user chooses, they can override the admin's AI model too.
- **Bring-Your-Own-DB:** The app ships with Postgres, but points at any you already have, Supabase and Neon included. Paste the connection string your provider gives you, pick the schema with `DB_SCHEMA` and it is created for you, and run `docker-compose.external-db.yml` to leave the bundled database out.
