#!/bin/sh
set -eu

: "${VITE_API_BASE_URL:=http://localhost:8000}"

cat > /usr/share/nginx/html/config.js <<JS
window.__PARCOURSE_CONFIG__ = { apiBaseUrl: "${VITE_API_BASE_URL}" };
JS

exec "$@"
