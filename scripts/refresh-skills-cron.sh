#!/usr/bin/env bash
# Hourly refresh of external coworker skills from shader-slang/slang-skills,
# with NO container kills and NO service restart.
#
# Two steps:
#   1. scripts/fetch-skills.sh   — pull upstream changes into container/skills/.
#   2. scripts/mirror-skills.mjs — copy those into every group's .claude-shared/,
#                                  which is already bind-mounted at
#                                  /home/node/.claude in every running container.
#
# Step 2 is what makes this zero-downtime, and it is not optional:
# `container/skills/` is not mounted into containers, so step 1 alone changes
# nothing for a live agent. See the header of scripts/mirror-skills.mjs for the
# full mount/copy chain.
#
# Install (do NOT run from a deploy — this is a standalone cron):
#   lego:  37 * * * * /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/refresh-skills-cron.sh
#   prod:  37 * * * * /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/refresh-skills-cron.sh
#
# Cadence: hourly. shader-slang/slang-skills took 65 commits in the 92 days to
# 2026-08-06 (~0.7/day) but arrives in bursts — up to 7 commits in a single day.
# The cost of a no-op run is ~1 API call per declared skill (a tree-sha compare,
# ~20 calls) against a 5,000/hour authenticated budget, so hourly spends well
# under 10% of one hour's budget spread across a whole day. Six-hourly would
# save nothing measurable and would leave a skill fix un-deployed for up to six
# hours. Runs at :37 to stay clear of funnel-cron's `17 */6`.
#
# Usage: refresh-skills-cron.sh [--dry-run]
set -uo pipefail

REPO="${NANOCLAW_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Cron has a minimal environment. Set PATH/HOME explicitly, and strip proxy vars
# for the same reason funnel-cron.sh does: a leaked http_proxy would tunnel the
# GitHub calls through the OneCLI gateway and corrupt them.
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export HOME="${HOME:-/home/ubuntu}"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NODE_USE_ENV_PROXY
export no_proxy='*' NO_PROXY='*'

DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN="--dry-run"

cd "$REPO" || exit 1
LOG="$REPO/logs/refresh-skills-cron.log"
mkdir -p "$REPO/logs"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# Serialize against a previous run that is still going. A refresh replaces a
# skill directory (rm -rf + copy), so two of them interleaving could hand a live
# container a half-written tree. Non-blocking: if the lock is held, the previous
# run is still doing the work and this tick has nothing to add.
LOCK="$REPO/logs/.refresh-skills.lock"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "skipped — a previous run still holds $LOCK"
    exit 0
  fi
else
  # Both target boxes are Linux and have util-linux flock. Say so out loud
  # rather than running unserialized while pretending nothing is different.
  log "WARNING: flock not found — running without a lock"
fi

log "refresh start${DRY_RUN:+ (dry-run)}"

# cron's PATH is not a login shell's. Name the missing tool instead of letting
# step 2 fail with a bare rc=127.
for tool in node gh jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log "FAILED: '$tool' not on PATH ($PATH)"
    exit 127
  fi
done

# ── step 1: fetch upstream into container/skills/ ───────────────────────────
# Capture rc IMMEDIATELY. Not on the next line, not inside an echo — a `$(date)`
# in the message expands first and resets `$?` to date's status. That exact bug
# is why scripts/funnel-cron.sh has always logged "FAILED (rc=0)".
if [ -n "$DRY_RUN" ]; then
  log "fetch-skills: skipped (dry-run)"
  fetch_rc=0
else
  fetch_out=$(bash "$REPO/scripts/fetch-skills.sh" 2>&1)
  fetch_rc=$?
  printf '%s\n' "$fetch_out" | sed 's/^/  | /' >> "$LOG"
fi

if [ "$fetch_rc" -ne 0 ]; then
  log "fetch-skills FAILED (rc=$fetch_rc) — NOT mirroring; container/skills/ may be partial"
  log "refresh end (failed)"
  tail -500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
  exit "$fetch_rc"
fi
log "fetch-skills ok (rc=0)"

# ── step 2: mirror into every live group's bind-mounted .claude-shared ──────
# Only reached when step 1 fully succeeded. Mirroring off a partial fetch would
# push an inconsistent skill set into running containers; the next hourly tick
# retries and self-heals instead.
mirror_out=$(node "$REPO/scripts/mirror-skills.mjs" --root "$REPO" ${DRY_RUN:+--dry-run} 2>&1)
mirror_rc=$?
printf '%s\n' "$mirror_out" | sed 's/^/  | /' >> "$LOG"

if [ "$mirror_rc" -ne 0 ]; then
  log "mirror-skills FAILED (rc=$mirror_rc)"
  log "refresh end (failed)"
  tail -500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
  exit "$mirror_rc"
fi

log "mirror-skills ok (rc=0)"
log "refresh end (ok)"

# Keep the log bounded.
tail -500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
