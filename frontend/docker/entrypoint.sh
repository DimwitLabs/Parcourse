#!/bin/sh
set -eu

: "${VITE_API_BASE_URL:=http://localhost:8000}"
: "${SHARED_THEME_DOMAIN:=}"

cat > /usr/share/nginx/html/config.js <<JS
window.__PARCOURSE_CONFIG__ = { apiBaseUrl: "${VITE_API_BASE_URL}", themeDomain: "${SHARED_THEME_DOMAIN}" };
JS

exec "$@"
