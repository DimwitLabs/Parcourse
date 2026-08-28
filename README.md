# Parcourse

[![AI-DECLARATION: copilot](https://img.shields.io/badge/䷼%20AI--DECLARATION-copilot-fee2e2?labelColor=fee2e2)](AI-DECLARATION.md)
[![Dimwit Pledge](https://dimwit.me/pledge.svg)](https://dimwit.me/pledge)

<p align="center"><img src="landing/og.png" alt="Parcourse. Turn curiosity into knowledge." width="100%" /></p>

<p align="center"><a href="https://parcourse.dimwit.me">parcourse.dimwit.me</a></p>

> [!NOTE]
> This project is backed by the [Dimwit Pledge](https://dimwit.me/pledge).

Parcourse is an open-source app that transforms YouTube videos into structured learning experiences. Paste any URL and get AI-generated sections, summaries, and quiz questions with instant feedback. The app builds a personal knowledge graph mapping your growth across topics, supports multi-user administration, and works with any provider LiteLLM reaches (OpenRouter, OpenAI, Anthropic, Gemini, Groq, a local Ollama, and more), configured from the Settings page and stored encrypted.

It is deliberately not a discovery tool. There is no catalogue, no feed and nothing recommended, and it will never suggest what to learn next: you bring the link. Everything in a notebook is therefore there because someone put it there, and each account keeps its own courses, progress and graph rather than sharing them with the instance.

Parcourse is already a word in English, an outdoor fitness trail lined with exercise stations, but that is not where this name comes from. It is a pun. *Parcours* is French for a route, a path, the way through something, and a course is, well, a course. Parcourse is the personal path you build through the videos you already enjoy.

## Running it

You need Docker and an API key from a provider of your choice. Both halves of the app are published as images, so nothing is built locally.

```bash
cp .env.example .env
docker compose -f docker-compose.ghcr.yml up -d
```

That pulls `ghcr.io/dimwitlabs/parcourse-backend` and `ghcr.io/dimwitlabs/parcourse-frontend` at `latest`. Set `PARCOURSE_VERSION` to `development` or to a version such as `1.5.0` to follow a different tag. `docker-compose.yml` is the one that builds from the source instead.

Set `JWT_SECRET` and `ENCRYPTION_KEY` in `.env` first. Generate the encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The app is on http://localhost:5173 and the API on http://localhost:8000. The first visit walks you through creating an admin account and connecting a provider.

## Documentation

[docs.parcourse.dimwit.me](https://docs.parcourse.dimwit.me)

Running it on a VPS, using your own Postgres, connecting a provider, managing accounts, upgrading, and every setting it reads are all documented there.

Contributors should read [CONTRIBUTING.md](CONTRIBUTING.md), which covers the development setup and how to run the tests.

## Attribution

A video belongs to whoever made it. Parcourse does not host, mirror or re-upload anything, and it claims none of it. The video plays from YouTube in YouTube's own player, so watching it inside a course is watching it on YouTube, and the course around it is written from the transcript that already came with it.

So if a video taught you something, go and subscribe to the person who made it, and support them with likes, comments and, if possible, direct donations, or however else they have asked to be supported. All Parcourse does is help you retain and understand what they taught you.

## Credits

The Parcourse logo is inspired by one of the many potential `interrobang`s from the Inter font by @rsms, from [this GitHub thread](https://github.com/rsms/inter/issues/69#issuecomment-423794926).

Licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).
