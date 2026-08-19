# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-20

### Added

- **Dark Theme:** Every screen has a dark counterpart, warm charcoal rather than black, with the sage green carried through and a wordmark drawn for it. Auto, Light and Dark sit in the profile menu, and on the sign-in, setup and password screens.
- The choice is remembered and applied before the page paints, so a dark session never flashes white, and it reaches any other tab already open. The landing page follows the system the same way.

### Changed

- The knowledge graph exports with a transparent background, as an SVG or a PNG, so it sits on whatever it is dropped into, and is drawn light whichever theme it was exported from.
- A shared result card stays on light paper, since it is read wherever it is sent rather than here.

### Fixed

- Every colour and corner the stylesheet asks for now has a name that exists. Five were referenced and never defined: the generation pills lost their background and their pending dot, an empty-state line its softer grey, and a dropdown row its rounded corners.
- The zoom controls on the knowledge graph carry icons rather than characters, so they sit level with Reset beside them.
- The theme control is a radio group, so the arrow keys move through it and it reads as one choice of three rather than three switches.
- A browser that refuses local storage no longer takes the app down on load.

## [1.1.1] - 2026-08-19

### Changed

- **Submitting Again:** A graded quiz no longer offers to "Submit Quiz" as though nothing had happened. The button reads Submit again, and the last score sits above it, linking to that result.
- The small icon buttons carry the app's own hint instead of the browser's tooltip. A locked one now explains itself: a course finished by passing its quiz reads Mastered.

### Fixed

- Opening a page starts at its top. Going back still returns to where you were.
- The done tick on a notebook card is drawn at the size of the icons beside it.

## [1.1.0] - 2026-08-19

### Added

- **Shareable Result Cards:** A quiz result can be sent out as a picture. The card is drawn as the results page reads: the score in its ring inside the dashed frame, the performance summary beside it, and the tutor's analysis under both. A phone hands it to whatever it shares with; a desktop puts it on the clipboard, or saves it where the clipboard is refused.

### Changed

- **Score Ring:** The ring behind the score is held back from the arc at both ends, with rounded caps on each, in the manner Material draws a circular indicator. It closes into a full ring at a perfect score. The same treatment carries onto the shared card.
- **Configuring AI:** On a phone, where nothing can be hovered, the create bar fills itself on arrival and settles as a Configure AI button, so what it does when tapped is what it looks like.

### Fixed

- **Create Bar:** A long button label no longer pushes itself out of the bar on a narrow screen, which was also what let the whole page be dragged sideways.
- **Long Titles:** A page heading wraps on a phone rather than running off the edge, and an unbroken string anywhere breaks instead of widening the page.
- **Generation Pills:** The spinner sits against the middle of its label rather than the top of its first line.
- **Knowledge Graph:** The granularity pills, the zoom and export controls, and the legend are centred on a phone instead of hugging the left edge. The empty-state line wraps instead of being cut off, and has dropped an icon that read as a share button.

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
