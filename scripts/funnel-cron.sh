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
# Every writer below targets reports/. A fresh checkout has no such directory and
# the writers do not create one, so without this the whole run fails on ENOENT
# with nothing but a stack trace to show for it.
mkdir -p "$REPO/reports"

# Run a refresh step and log its REAL exit code.
#
# The obvious spelling of this is a lie:
#     echo "[$(date -u ...)] ... FAILED (rc=$?)"
# `$(date)` is a subshell that runs BEFORE the interpolation of `$?`, and it
# succeeds, so `$?` is its status — 0. Every failure logged "rc=0" and looked
# like a clean run to anyone reading the log. Capture RC first, interpolate second.
run_step() {
  local label="$1"
  shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $label refresh start" >> "$LOG"
  "$@" >> "$LOG" 2>&1
  local rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $label refresh ok" >> "$LOG"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $label refresh FAILED (rc=$rc)" >> "$LOG"
  fi
  return "$rc"
}

# Track whether anything failed, but keep going — one broken producer must not
# stop the others from refreshing.
FAILURES=0

# ORDER MATTERS. Every REST producer below draws on ONE shared budget: the
# shader-slang App-installation token's 5000 core-REST calls/hr, which live
# coworkers spend from too. funnel.ts (~180 calls) and regression-quality
# (hundreds, across per-PR pulls/{n} lookups) are the two big drains, so whichever
# runs LAST can find the budget already exhausted and fail closed on a 403 "rate
# limit exceeded". regression-quality is the one that kept losing that race, so it
# runs FIRST here — before funnel spends the budget — and carries its own
# rate-limit backoff as a second line of defence. review-rounds is GraphQL (a
# SEPARATE point budget) and bot-contributions is now GraphQL too, so neither
# competes for the core-REST budget; their position is not load-bearing.

# Regression-quality snapshot for the panel beside the funnel (dashboard
# /api/regression-quality serves reports/regression-quality.json cached and never
# recomputes). Companion to reviewCycles, which funnel.ts already embeds in
# funnel.json below. Read-only gh API calls; same proxy-stripped env.
# NOTE: python3, not tsx. This cron runs on the HOST, where python3 is present
# (the kb-health cron uses it too) — no container image is involved.
# Fail-closed exit codes (nonzero when its collection was incomplete, so an outage
# cannot publish as a clean zero) plus rate-limit backoff/retry live in the script;
# the rc capture above is what makes either one visible in the log.
run_step regression-quality /usr/bin/python3 scripts/regression-quality.py --json reports/regression-quality.json ||
  FAILURES=$((FAILURES + 1))

run_step funnel pnpm exec tsx scripts/funnel.ts --since 2026-04-10 --out reports/funnel.json || FAILURES=$((FAILURES + 1))

# nv-slang-bot contributions snapshot for the panel under the funnel
# (dashboard /api/bot-contributions serves reports/bot-contributions.json
# cached and never recomputes). Without this the panel is stuck on
# "no snapshot yet" until someone hits the manual refresh button — the
# funnel-cron never generated it. Same proxy-stripped env + gh-App-token
# path as the funnel above; now a per-repo-page GraphQL census (its own point
# budget), so it no longer competes for the core-REST budget above.
run_step bot-contributions pnpm exec tsx scripts/bot-contributions.ts || FAILURES=$((FAILURES + 1))

# Review-rounds snapshot for the panel beside the funnel (dashboard
# /api/review-rounds serves reports/review-rounds.json cached and never
# recomputes). How many human CHANGES_REQUESTED rounds a PR drew before it
# merged, bot-authored vs human-authored, bucketed by merge week. Distinct from
# reviewCycles (which prices feedback SESSIONS inside funnel.json) — this is a
# simpler per-submission census over the GitHub GraphQL API. python3 on the HOST
# (same reason as regression-quality above); same proxy-stripped env; direct
# curl to api.github.com/graphql with the shader-slang App-installation token.
# Its fail-closed exit code (nonzero when collection was incomplete, so an outage
# cannot publish a clean zero) is what the rc capture surfaces in the log.
run_step review-rounds /usr/bin/python3 scripts/review-rounds.py --json reports/review-rounds.json ||
  FAILURES=$((FAILURES + 1))

# Keep the log bounded.
tail -200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"

# Surface the aggregate to cron (which mails/records a nonzero exit) rather than
# always reporting success because the last command happened to be `mv`.
[ "$FAILURES" -eq 0 ] || exit 1
