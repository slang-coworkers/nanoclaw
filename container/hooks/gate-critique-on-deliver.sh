#!/usr/bin/env bash
# PreToolUse hook (matcher: mcp__nanoclaw__send_message|Bash):
# refuse delivery / handoff / PR-create operations until at least one
# /codex-critique round has been recorded for this session.
#
# Symmetric opt-in (Model A): only fires for coworkers whose overlays
# include `critique-gate`. The composer materializes the marker file at
# /workspace/agent/.overlay-critique-gate; this hook checks for it first
# and exits 0 (no-op) when absent. Coworkers without the overlay can
# still emit [Fix Report] etc. without enforcement — opt-in by design.
#
# Delivery markers (text-prefix on send_message):
#   [Fix Report] [Resolution] [Triage Resolution] [Review Verdict] [handoff]
# PR commands (Bash):
#   gh pr create
#   gh api .../pulls
#
# Force-push gates intentionally NOT wired in v1 — too noisy for legitimate
# rebases of feature branches; revisit if abuse pattern emerges.
#
# Stdin: JSON with tool_name, tool_input. Exit 0 = allow, exit 2 = deny.
set -euo pipefail

# Opt-in gate — overlay-marker check (Model A symmetric opt-in).
# Path is overridable for testing; container default is /workspace/agent/.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
[ -f "$OVERLAY_DIR/.overlay-critique-gate" ] || exit 0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // .tool_input.command // ""')

HIT=""
case "$TOOL" in
  mcp__nanoclaw__send_message)
    if echo "$TEXT" | grep -qE '\[(Fix Report|Resolution|Triage Resolution|Review Verdict|handoff)\]'; then
      HIT="delivery/handoff message"
    fi
    ;;
  Bash)
    if echo "$TEXT" | grep -qE '(gh pr create|gh api [^|]*pulls\b)'; then
      HIT="PR creation"
    fi
    ;;
esac

[ -z "$HIT" ] && exit 0

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
ROUNDS=$(jq -r '.critique_rounds // 0' "$STATE" 2>/dev/null || echo 0)

if [ "$ROUNDS" -lt 1 ]; then
  cat >&2 << EOF
CRITIQUE REQUIRED before $HIT.

Invoke /codex-critique on the work you are about to deliver, then retry.
Codex will read the artifacts, score them, and either approve or return
must-fix items. critique_rounds=$ROUNDS in this session.

This gate fires once per session — once a critique round is recorded,
subsequent deliveries within the same session pass through. State file:
$STATE
EOF
  exit 2
fi

exit 0
