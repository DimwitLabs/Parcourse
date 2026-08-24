---
id: configuration
title: Configuration
---

# Configuration

Everything is set in `.env`, copied from `.env.example` at the root of the repository. Nothing here is read from anywhere else.

## Required

Neither has a default, and both belong in `.env` before the first run.

| Variable | What it does |
| --- | --- |
| `JWT_SECRET` | Signs sign-in tokens. Changing it signs everyone out. |
| `ENCRYPTION_KEY` | Encrypts stored provider keys. Changing it makes every stored key unreadable. |

Generate the encryption key with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Database

| Variable | Default | What it does |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `parcourse` | Password for the bundled Postgres. |
| `DATABASE_URL` | built from the above | Points at an external Postgres. `postgresql://` and `postgres://` both work. |
| `DB_SCHEMA` | `public` | Which schema the tables live in. Created for you if it does not exist. |

:::note
Leave `DATABASE_URL` unset when using the bundled database. Setting it as well as `POSTGRES_PASSWORD` means the two can disagree.
:::

## Addresses

| Variable | Default | What it does |
| --- | --- | --- |
| `BACKEND_PORT` | `8000` | Port the API is served on. |
| `FRONTEND_PORT` | `5173` | Port the app is served on. |
| `VITE_API_BASE_URL` | `http://localhost:8000` | The API address the browser calls. Behind a proxy this must be the public one. |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | JSON array of origins allowed to call the API. |

`VITE_API_BASE_URL` and `CORS_ORIGINS` have to agree with wherever the app is actually reached from. They are the two that catch people out behind a reverse proxy.

## Fetching Transcripts

| Variable | Default | What it does |
| --- | --- | --- |
| `YTDLP_PROXY` | empty | Sends only the YouTube fetches through a proxy. Leave empty at home. |
| `VPN_SERVICE_PROVIDER` | | OpenVPN provider name, for the bundled VPN sidecar. |
| `OPENVPN_USER` | | The provider's OpenVPN username, not the website login. |
| `OPENVPN_PASSWORD` | | The matching password. |
| `FREE_ONLY` | `off` | Set `on` when the VPN account is a free one. |
| `VPN_ROTATIONS` | `2` | Reconnects to try when a fetch is refused. `0` disables rotation. |
| `VPN_CONTROL_URL` | `http://vpn:8000` | Where a reconnect is requested. |

The VPN variables are only read by `docker-compose.ghcr-vpn.yml`. See [Troubleshooting](/self-hosting/troubleshooting) for when any of this is needed.

## Logging

| Variable | Default | What it does |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | One of `debug`, `info`, `warning`, `error`, `critical`. |

## The API's Own Reference

The backend is FastAPI, so every instance serves an interactive schema of its own routes at `/docs` on the API port. That is the reference, and it is always correct for the version you are running.
