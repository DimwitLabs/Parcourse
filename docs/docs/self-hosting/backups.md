---
id: backups
title: Backups and Recovery
---

# Backups and Recovery

Everything Parcourse keeps — your courses, notes, quiz history and knowledge graph — lives in Postgres. Backing up the database backs up the whole instance.

## Taking a Backup

If you run the bundled database, the compose files that carry a `db` service, there is a script for it:

```bash
./scripts/backup.sh
```

That writes `parcourse-YYYYMMDD-HHMMSS.sql.gz` in the project directory. Pass a path to choose the name yourself:

```bash
./scripts/backup.sh /backups/parcourse-nightly.sql.gz
```

A nightly one is a cron line away:

```
0 3 * * * cd /opt/parcourse && ./scripts/backup.sh /backups/parcourse-$(date +\%A).sql.gz
```

That keeps seven files named for the days of the week, each overwritten a week later.

If you point Parcourse at a database you host elsewhere, use your provider's backups instead. Managed Postgres almost always has them turned on already, and they recover faster than a dump.

## Restoring

```bash
./scripts/restore.sh parcourse-20260907-030000.sql.gz
```

It asks for confirmation first, because it replaces everything currently in the database. Restart the backend afterwards so it reconnects:

```bash
docker compose restart backend
```

## Forgotten Admin Password

An admin can reset anyone's password from the Users screen, but nobody can reset the admin's. If you are locked out, do it from the host:

```bash
docker compose exec backend python -m manage reset-password you@example.com
```

It asks for the new password twice and does not echo it. The account is asked to change it at the next sign in.

If you have set `OIDC_ONLY=true`, this command refuses, because the password it would set could not be used to sign in with. Set `OIDC_ONLY=false` and restart to bring the password form back, then run it.

## What Is Not in the Database

Two things live in your `.env` rather than in Postgres, and a database backup does not include them:

- `ENCRYPTION_KEY`, which encrypts the provider API keys stored in the database. **Restore a backup without the key that made it and those keys cannot be read.** You would have to enter them again.
- `JWT_SECRET`, which signs sessions. Losing it signs everyone out, and nothing worse.

Keep a copy of `.env` wherever you keep the dumps.
