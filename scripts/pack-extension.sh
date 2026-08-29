#!/usr/bin/env bash
# The store rejects a zip whose manifest is not at the root, hence the cd.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$root/extension/manifest.json")"
out="$root/dist/parcourse-$version.zip"

mkdir -p "$root/dist"
rm -f "$out"
cd "$root/extension"
zip -r -X -q "$out" . \
    --exclude 'README.md' '.DS_Store' '*/.DS_Store' '__MACOSX/*'

echo "$out"
unzip -l "$out"
