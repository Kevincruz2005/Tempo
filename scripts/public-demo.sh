#!/usr/bin/env sh
set -eu

origin="${TEMPO_PUBLIC_ORIGIN:-http://127.0.0.1:7333}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required. Install it from Cloudflare's official downloads page:" >&2
  echo "https://developers.cloudflare.com/tunnel/downloads/" >&2
  exit 127
fi

if ! curl -fsS "$origin/health" >/dev/null; then
  echo "TEMPO is not reachable at $origin. Start the firm first with: npm run firm" >&2
  exit 1
fi

echo "Publishing $origin with a temporary TryCloudflare URL. Keep this process running."
echo "Quick tunnels are for demos and use polling fallback because SSE is not supported."
exec cloudflared tunnel --url "$origin" --http-host-header "127.0.0.1:7333"
