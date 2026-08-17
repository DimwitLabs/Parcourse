# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/DimwitLabs/Parcourse/security/advisories/new) rather than opening a public issue.

Tell me what you did, what happened, and what you expected instead. A proof of concept helps but is not required. I will respond within a week, and you will be credited in the advisory unless you would rather not be named.

## Supported versions

Only the latest release gets fixes. Parcourse is self-hosted, so upgrading is a `docker compose pull` away.

## Running it safely

Parcourse stores real provider credentials, which makes a few deployment choices matter more than the rest.

The most important one is to set your own `JWT_SECRET` and `ENCRYPTION_KEY`. The values that ship in `docker-compose.yml` are development defaults, and they are published in this repository for anyone to read. An instance still running them can have its session tokens forged and its stored provider keys decrypted by anyone who notices.

Beyond that, keep Postgres unreachable from outside the machine, since only the app needs to talk to it, and serve the app over TLS, because tokens and API keys travel in ordinary requests that anyone on the network path can read. If you serve the frontend from somewhere other than `localhost:5173`, set `CORS_ORIGINS` to match, or the browser will block the app from reaching its own API.

Provider credentials are encrypted at rest with Fernet and are never sent back to the client. That protects a stolen database dump on its own, but not a dump taken alongside your `ENCRYPTION_KEY`, so both deserve the same care.

## Known by design

A few things look like findings but are intentional, so please do not report them.

Testing a connection makes the server call a URL you supply, which is how a local Ollama or a self-hosted gateway works at all. Only signed-in users can trigger it, and the connection each of them can reach is limited to their own, except for admins, who can reach the shared instance one.

Any model ID is accepted, because the provider list is a set of suggestions rather than an allowlist. Course generation is also synchronous, so a long video holds a request open until it finishes; that is a known limitation on the roadmap rather than a denial-of-service report.
