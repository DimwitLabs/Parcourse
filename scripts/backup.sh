#!/usr/bin/env bash
# Dumps the bundled Postgres to a file. Only for the compose files that run
# their own database; with an external one, use whatever your provider gives
# you. Restore with restore.sh.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

out="${1:-parcourse-$(date +%Y%m%d-%H%M%S).sql.gz}"
user="${POSTGRES_USER:-parcourse}"

# --clean --if-exists so restoring over a live database replaces what is
# there rather than colliding with it.
docker compose exec -T db pg_dump --clean --if-exists -U "$user" parcourse | gzip > "$out"

echo "Wrote $out ($(du -h "$out" | cut -f1))"
