# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-17

### Added

- **Course Generation:** Transcript extraction, a guardrail check that the video is actually educational, then AI-generated sections, summaries, multiple-choice and theory questions.
- **Quiz Scoring:** Multiple choice is scored by match; theory answers are graded by the AI against a reference answer across accuracy, completeness and relevance, with written feedback.
- **Knowledge Graph:** Concepts are extracted per course into fields, topics and skills, deduplicated by label across the instance, with mastery tracked per user.
- **Quality-of-Life:** Course regeneration is supported with feedback from the user for videos. The platform also detects if something is not a course and flags it during generation itself.
- **Provider-agnostic:** Pick one from a dropdown and the form adapts to the fields it needs, from a single API key to a local Ollama URL or three AWS fields. Model suggestions are offered per provider, and any model ID is accepted. Note that not all models are tested and if you face any problems, please raise an [issue](https://github.com/DimwitLabs/Parcourse/issues).
- **Multi-user System:** The admin can set a system-level AI configuration and invite more users. The admin gets a generated password that they can edit and share with the users if they want. The user can then set their own password. If the user chooses, they can override the admin's AI model too.
