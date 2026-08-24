---
id: install
title: Installing
---

# Installing

You need Docker and an API key from a model provider of your choice. Nothing is built locally: both halves of Parcourse are published as images, for `linux/amd64` and `linux/arm64`.

```bash
docker pull ghcr.io/dimwitlabs/parcourse-backend:latest
docker pull ghcr.io/dimwitlabs/parcourse-frontend:latest
```

| Image | What it is |
| --- | --- |
| `ghcr.io/dimwitlabs/parcourse-backend` | The API, the transcript fetching and the generation |
| `ghcr.io/dimwitlabs/parcourse-frontend` | The app you look at |

## Which Tag to Pull

| Tag | Points at | What it means |
| --- | --- | --- |
| `latest` | `main` | Stability. Features arrive once they have settled. |
| `development` | `development` | The newest work, with the rough edges that come with it. |
| `1.4.0` | That release | Pinned exactly where you are, until you say otherwise. |
| `1.4` | That minor line | Patches arrive, features do not. |

Swap the tag for whichever of those you want:

```bash
docker pull ghcr.io/dimwitlabs/parcourse-backend:development
docker pull ghcr.io/dimwitlabs/parcourse-frontend:development
```

## Running Them

The images need a database and a few environment variables around them, which the published compose file wires up:

```bash
git clone https://github.com/DimwitLabs/Parcourse.git
cd Parcourse
cp .env.example .env
docker compose -f docker-compose.ghcr.yml up -d
```

The clone is only there for the compose file and `.env.example`. Nothing in it is built.

`PARCOURSE_VERSION` picks the tag both images are pulled at, and defaults to `latest`:

```bash
PARCOURSE_VERSION=development docker compose -f docker-compose.ghcr.yml up -d
```

The app is on `http://localhost:5173` and the API on `http://localhost:8000`. The first visit walks you through [creating an admin account and connecting a provider](/first-run).

## Two Secrets to Set First

`JWT_SECRET` and `ENCRYPTION_KEY` have no defaults, and both belong in `.env` before the first run. Generate the encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

:::warning
`ENCRYPTION_KEY` is what every stored provider key is encrypted with. Change it or lose it and those keys become unreadable, and everyone on the instance has to enter theirs again. Keep it wherever you keep your other secrets.
:::

## Which Compose File

Parcourse ships four, and which one you want depends on where it is running and what database it should talk to.

| File | Use it when |
| --- | --- |
| `docker-compose.ghcr.yml` | The published images and the bundled Postgres. Start here. |
| `docker-compose.external-db.yml` | The published images, and you already have a Postgres |
| `docker-compose.ghcr-vpn.yml` | On a VPS, where YouTube refuses the address |
| `docker-compose.yml` | Building the images yourself from a checkout |

The VPN one is covered in [Troubleshooting](/self-hosting/troubleshooting), since it exists to solve a specific problem rather than as a general way to run. The last is for working on Parcourse rather than running it, and it builds from the source next to it instead of pulling anything.

## Using Your Own Database

The bundled Postgres is a convenience, not a requirement. Parcourse talks to any Postgres, including Supabase and Neon. Point `DATABASE_URL` at it and use the compose file that leaves the database out:

```bash
DATABASE_URL=postgresql://user:password@host:5432/postgres docker compose -f docker-compose.external-db.yml up -d
```

Paste the connection string exactly as your provider gives it. Both `postgresql://` and `postgres://` work.

Set `DB_SCHEMA` if you would rather the tables sat somewhere other than `public`. The schema is created for you.

## Behind a Reverse Proxy

Two values need to agree with wherever the app is actually served from:

- `VITE_API_BASE_URL` is the address the browser calls, so it must be the public API address rather than `http://localhost:8000`.
- `CORS_ORIGINS` must list the public frontend address.

Both are in [Configuration](/reference/configuration).

## Running the Tests

```bash
docker compose exec backend python -m unittest discover -s tests
```
