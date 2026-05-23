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
# Stdin: JSON event payload with `session_id`, `tool_name`, ... per the
# Claude Code hook spec. We extract session_id here and forward it to
# buddy-call.sh as an explicit env var so JSONL discovery in the detached
# child works without depending on env-var inheritance from the SDK.
#
# Exit 0 always.
set -euo pipefail

# Opt-in marker check (path overridable for tests)
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
[ -f "$OVERLAY_DIR/.overlay-buddy-monitor" ] || exit 0

# Read full hook payload — we need both tool_name (filter) and session_id
# (forward to buddy-call). Claude Code hook contract guarantees both
# fields are populated on PostToolUse.
INPUT=$(cat)
TOOL=$(jq -r '.tool_name // ""' <<<"$INPUT" 2>/dev/null || echo "")
SID=$(jq -r '.session_id // empty' <<<"$INPUT" 2>/dev/null || echo "")

# Skip read-only tools — they don't change reviewable state
case "$TOOL" in
  Read|Grep|Glob|LS|WebSearch|WebFetch) exit 0 ;;
esac

# Ensure buddy state dir exists. Path is overridable for testing
# (BUDDY_STATE_DIR); container default is /workspace/.claude/buddy/ —
# per-session via the /workspace mount.
BUDDY_DIR="${BUDDY_STATE_DIR:-/workspace/.claude/buddy}"
mkdir -p "$BUDDY_DIR" 2>/dev/null || true

# Fire and forget — buddy-call.sh has its own lock; concurrent fires are safe.
# nohup + & + disowned input/stdout/stderr keeps the hook from blocking on
# codex exec wall time (which can be 30-120s).
#
# Forward session_id explicitly. Claude SDK names its session JSONL by
# session UUID at /home/node/.claude/projects/<slug>/<session-uuid>.jsonl,
# so buddy-call.sh's `find -name "${SID}*.jsonl"` correctly locates the
# CURRENT session's transcript — not whatever happens to be newest on disk.
# Falling back to env CLAUDE_SESSION_ID if stdin omitted the field (defense
# in depth; standard hook events always include it).
nohup env CLAUDE_SESSION_ID="${SID:-${CLAUDE_SESSION_ID:-}}" \
  bash /app/scripts/buddy-call.sh \
  >> "$BUDDY_DIR/log.jsonl" 2>&1 \
  </dev/null &

exit 0
