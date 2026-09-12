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
PARCOURSE_VERSION=1.5.0 docker compose -f docker-compose.ghcr.yml up -d
```

The tags are listed in [Installing](/self-hosting/install). A pinned version stays put until you change it, which is the way to sit still while `latest` moves.

## Moving to Postgres 18

Version 1.7.0 moves the bundled database from Postgres 16 to 18. Two things change together, and either one on its own would stop the container starting.

Postgres will not read a data directory written by an older major version. And the Postgres 18 images keep their data one directory further up, so the volume now mounts at `/var/lib/postgresql` rather than `/var/lib/postgresql/data`. If you run one of the compose files from this repository, that second change is already made for you; if you wrote your own, make it yourself.

The way across is a dump and a restore.

If you point Parcourse at a database you host elsewhere, none of this applies. The bundled image is unused on your instance and the version your provider runs is their business.

Take the backup **before** the new compose file is in place. If you have already pulled 1.7.0, put `image: postgres:16-alpine` back in your compose file for the moment, so the old database starts one last time:

```bash
./scripts/backup.sh parcourse-before-18.sql.gz
```

Check the file is a sensible size before going further. If it is a few hundred bytes, something went wrong and you should stop.

Then stop the instance and delete the old data directory:

```bash
docker compose down
```

```bash
docker volume ls | grep postgres_data
```

```bash
docker volume rm <the name that printed>
```

The volume is named after the directory you run from, so it reads something like `parcourse_postgres_data`. This step throws the database away, which is why the dump comes first.

Now bring it up on 18 with the new compose file and load the dump back in:

```bash
docker compose up -d
```

```bash
./scripts/restore.sh parcourse-before-18.sql.gz
```

```bash
docker compose restart backend
```

Sign in and open a course to confirm it came back. Keep the dump until you are satisfied.

## Before You Pull

Read the [changelog](https://github.com/DimwitLabs/Parcourse/blob/main/CHANGELOG.md). Anything an upgrade needs a hand with is called out there.

Back the database up before a major upgrade if the courses on it matter to you. Going back a version is not something to count on.
