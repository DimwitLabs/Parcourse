# Parcourse

[![AI-DECLARATION: copilot](https://img.shields.io/badge/䷼%20AI--DECLARATION-copilot-fee2e2?labelColor=fee2e2)](AI-DECLARATION.md)

<p align="center"><img src="frontend/public/parcourse-wordmark.svg" alt="Parcourse" height="52" /></p>

Parcourse is an open-source app that transforms YouTube videos into structured learning experiences. Paste any URL and get AI-generated sections, summaries, and quiz questions with instant feedback. The app builds a personal knowledge graph mapping your growth across topics, supports multi-user administration, and works with any provider LiteLLM reaches (OpenRouter, OpenAI, Anthropic, Gemini, Groq, a local Ollama, and more), configured from the Settings page and stored encrypted.

## Running it

You need Docker and an API key from a provider of your choice.

```bash
cp .env.example .env
docker compose up
```

Set `JWT_SECRET` and `ENCRYPTION_KEY` in `.env`. Generate the encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The app is on http://localhost:5173 and the API on http://localhost:8000. The first visit walks you through creating an admin account and connecting a provider; you can skip the provider and add it from Settings later although the app will nudge you to do it anyway.

## Tests

```bash
docker compose exec backend python -m unittest discover -s tests
```

## Credits

The Parcourse logo is inspired by one of the many potential `interrobang`s from the Inter font by @rsms, from [this GitHub thread](https://github.com/rsms/inter/issues/69#issuecomment-423794926).

Licensed under Apache 2.0. See [LICENSE](LICENSE).
