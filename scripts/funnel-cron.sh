#!/usr/bin/env bash
# Funnel snapshot refresh for the dashboard's /api/funnel panel.
# Run by system crontab (see `crontab -l`). Writes reports/funnel.json which
# dashboard/server.ts serves cached (it never recomputes — keeps ~180 gh calls
# out of the request path).
#
# Cron has a minimal environment: set PATH and strip any proxy vars (the funnel
# makes direct gh-API curls with --noproxy '*'; a leaked http_proxy would tunnel
# them through the OneCLI gateway and corrupt them).
set -uo pipefail

REPO="/home/ubuntu/slang-coworkers-prod/nanoclaw"
export PATH="/usr/local/bin:/usr/bin:/bin"
export HOME="/home/ubuntu"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NODE_USE_ENV_PROXY
export no_proxy='*' NO_PROXY='*'

cd "$REPO" || exit 1
LOG="$REPO/logs/funnel-cron.log"
mkdir -p "$REPO/logs"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] funnel refresh start" >> "$LOG"
if pnpm exec tsx scripts/funnel.ts --since 2026-04-10 --out reports/funnel.json >> "$LOG" 2>&1; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] funnel refresh ok" >> "$LOG"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] funnel refresh FAILED (rc=$?)" >> "$LOG"
fi

# nv-slang-bot contributions snapshot for the panel under the funnel
# (dashboard /api/bot-contributions serves reports/bot-contributions.json
# cached and never recomputes). Without this the panel is stuck on
# "no snapshot yet" until someone hits the manual refresh button — the
# funnel-cron never generated it. Same proxy-stripped env + gh-App-token
# path as the funnel above; a handful of read-only gh API calls.
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] bot-contributions refresh start" >> "$LOG"
if pnpm exec tsx scripts/bot-contributions.ts >> "$LOG" 2>&1; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] bot-contributions refresh ok" >> "$LOG"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] bot-contributions refresh FAILED (rc=$?)" >> "$LOG"
fi

# Regression-quality snapshot for the panel beside the funnel (dashboard
# /api/regression-quality serves reports/regression-quality.json cached and never
# recomputes). Companion to reviewCycles, which funnel.ts already embeds in
# funnel.json above. Read-only gh API calls; same proxy-stripped env.
# NOTE: this one is python3, not tsx — the hardened image drops python3, which is
# why container/Dockerfile.derived reinstalls it and build-derived.sh gates on it.
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] regression-quality refresh start" >> "$LOG"
if /usr/bin/python3 scripts/regression-quality.py --json reports/regression-quality.json >> "$LOG" 2>&1; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] regression-quality refresh ok" >> "$LOG"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] regression-quality refresh FAILED (rc=$?)" >> "$LOG"
fi

# Keep the log bounded.
tail -200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
