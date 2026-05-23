#!/usr/bin/env bash
# PostToolUse hook: fire buddy-call.sh asynchronously after each substantive
# primary-agent tool turn. Fire-and-forget — never blocks the agent's next turn.
#
# Symmetric opt-in (Model A): coworkers opt into buddy via
# `overlays: [buddy-monitor]` in coworker-types.yaml. The composer
# (PR #441 materializeOverlayMarkers) writes /workspace/agent/.overlay-buddy-monitor
# next to CLAUDE.md when buddy-monitor is in the resolved overlay set. This
# hook tests for that file; without it, exit 0 (no-op).
#
# Stdin: JSON with tool_name. Exit 0 always.
set -euo pipefail

# Opt-in marker check (path overridable for tests)
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
[ -f "$OVERLAY_DIR/.overlay-buddy-monitor" ] || exit 0

# Skip read-only tools — they don't change reviewable state
TOOL=$(jq -r '.tool_name // ""' <<<"$(cat)" 2>/dev/null || echo "")
case "$TOOL" in
  Read|Grep|Glob|LS|WebSearch|WebFetch) exit 0 ;;
esac

# Ensure buddy state dir exists; spawn buddy-call.sh detached.
# Path is overridable for testing (BUDDY_STATE_DIR); container default is
# /workspace/.claude/buddy/, which lives on the per-session /workspace mount.
BUDDY_DIR="${BUDDY_STATE_DIR:-/workspace/.claude/buddy}"
mkdir -p "$BUDDY_DIR" 2>/dev/null || true

# Fire and forget — buddy-call.sh has its own lock; concurrent fires are safe.
# nohup + & + disowned input/stdout/stderr keeps the hook from blocking on
# codex exec wall time (which can be 30-120s).
nohup bash /app/scripts/buddy-call.sh \
  >> "$BUDDY_DIR/log.jsonl" 2>&1 \
  </dev/null &

exit 0
