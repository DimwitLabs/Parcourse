# Parcourse

[![AI-DECLARATION: copilot](https://img.shields.io/badge/䷼%20AI--DECLARATION-copilot-fee2e2?labelColor=fee2e2)](AI-DECLARATION.md)

<p align="center"><img src="landing/og.png" alt="Parcourse. Turn curiosity into knowledge." width="100%" /></p>

<p align="center"><a href="https://parcourse.dimwit.me">parcourse.dimwit.me</a></p>

Parcourse is an open-source app that transforms YouTube videos into structured learning experiences. Paste any URL and get AI-generated sections, summaries, and quiz questions with instant feedback. The app builds a personal knowledge graph mapping your growth across topics, supports multi-user administration, and works with any provider LiteLLM reaches (OpenRouter, OpenAI, Anthropic, Gemini, Groq, a local Ollama, and more), configured from the Settings page and stored encrypted.

## Running it

You need Docker and an API key from a provider of your choice.

```bash
cp .env.example .env
docker compose up
```

### Running on a VPS

YouTube refuses transcript requests from datacenter addresses, so a server
rented anywhere is told to prove it is not a bot while the same app on a home
machine works untouched. Point `YTDLP_PROXY` at any proxy and only the YouTube
fetches go through it. A second deployment file runs a VPN alongside
the app for this, and any provider's proxy works just as well:

```bash
docker compose -f docker-compose.ghcr-vpn.yml up
```

A single address runs out of welcome eventually. When YouTube turns one away,
the VPN is asked for a different server and the fetch is tried again from
there, and only once `VPN_ROTATIONS` reconnects have all been refused does
anyone hear about it. Set it to zero to keep the address it started on.

Set `JWT_SECRET` and `ENCRYPTION_KEY` in `.env`. Generate the encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The app is on http://localhost:5173 and the API on http://localhost:8000. The first visit walks you through creating an admin account and connecting a provider; you can skip the provider and add it from Settings later although the app will nudge you to do it anyway.

## Using your own database

The app ships with a Postgres container, but it will talk to any Postgres you already have, including Supabase and Neon. Point `DATABASE_URL` at it and use the compose file that leaves the database out:

```bash
DATABASE_URL=postgresql://user:password@host:5432/postgres docker compose -f docker-compose.external-db.yml up
```

Paste the connection string exactly as your provider gives it; `postgresql://` and `postgres://` both work. Set `DB_SCHEMA` if you would rather the tables sat somewhere other than `public`, and the schema is created for you.

Set `LOG_LEVEL` to `debug`, `info`, `warning`, `error` or `critical` to change how much the backend says for itself; it defaults to `info`.

## Tests

```bash
docker compose exec backend python -m unittest discover -s tests
```

## Credits

The Parcourse logo is inspired by one of the many potential `interrobang`s from the Inter font by @rsms, from [this GitHub thread](https://github.com/rsms/inter/issues/69#issuecomment-423794926).

Licensed under Apache 2.0. See [LICENSE](LICENSE).
