#!/usr/bin/env sh
# The frontend and docs both run bundlers, so they @import shared/tokens.css
# directly. landing/ is served as a static directory with no build, so it needs
# a real file at /tokens.css. This generates it. CI runs this on the server
# after pulling; run it locally before previewing the landing page.
set -eu
cd "$(dirname "$0")/.."
cp shared/tokens.css landing/tokens.css
