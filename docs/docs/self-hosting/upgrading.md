---
id: upgrading
title: Upgrading
---

# Upgrading

Parcourse publishes two images, a frontend and a backend, and upgrading is a pull and a restart.

## The Pull

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Both images carry `pull_policy: always`, so a restart on a moving tag such as `latest` or `development` fetches whatever that tag points at now.

Without compose, the same two pulls by hand:

```bash
docker pull ghcr.io/dimwitlabs/parcourse-backend:latest
docker pull ghcr.io/dimwitlabs/parcourse-frontend:latest
```

## Moving Between Tags

`PARCOURSE_VERSION` decides which tag comes down. Set it in `.env` or in front of the command, and keep the two images on the same one:

```bash
PARCOURSE_VERSION=1.4.0 docker compose -f docker-compose.ghcr.yml up -d
```

The tags are listed in [Installing](/self-hosting/install). A pinned version stays put until you change it, which is the way to sit still while `latest` moves.

## Before You Pull

Read the [changelog](https://github.com/DimwitLabs/Parcourse/blob/main/CHANGELOG.md). Anything an upgrade needs a hand with is called out there.

Back the database up before a major upgrade if the courses on it matter to you. Going back a version is not something to count on.
