#!/usr/bin/env bash
# Loads a dump made by backup.sh over the bundled Postgres. This replaces
# everything currently in the database.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

dump="${1:?usage: restore.sh <dump.sql.gz>}"
user="${POSTGRES_USER:-parcourse}"

read -rp "This replaces the contents of the running database. Type yes to continue: " answer
[ "$answer" = "yes" ] || { echo "Cancelled."; exit 1; }

gunzip -c "$dump" | docker compose exec -T db psql -U "$user" -d parcourse

echo "Restored from $dump. Restart the backend so it reconnects: docker compose restart backend"
