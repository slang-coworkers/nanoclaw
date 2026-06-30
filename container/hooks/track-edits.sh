#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write|MultiEdit|NotebookEdit|Bash):
# pure telemetry — bumps edit counters in workflow-state.json. No threshold
# logic, no flag flipping. The critique gate (gate-critique-on-deliver.sh)
# fires on delivery markers regardless of edit count, so this counter is
# now informational rather than load-bearing. Edit-counter.sh's old role
# of "trip critique_required after N substantive edits" is retired —
# the new model gates at delivery time, not at arbitrary edit-count
# thresholds, so the agent can iterate freely until it tries to ship.
#
# Stdin: JSON with tool_name, tool_input.file_path or tool_input.command.
# Exit 0 always (PostToolUse cannot block).
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Bash: only count writes (heuristic match — same patterns as gate-plan.sh
# and the legacy edit-counter.sh, kept aligned so both hooks see the same
# command set as "an edit").
if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  [ -z "$CMD" ] && exit 0
  IS_WRITE=false
  if echo "$CMD" | grep -qP '(^|\s|\|)(>|>>)\s'; then
    IS_WRITE=true
  elif echo "$CMD" | grep -qP '\b(tee|sed\s+-i|patch\s|git\s+apply|git\s+am|dd\s)\b'; then
    IS_WRITE=true
  fi
  [ "$IS_WRITE" = "false" ] && exit 0
else
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
  [ -z "$FILE" ] && exit 0

  # Allowlist: workspace bookkeeping files don't count toward edit counters
  case "$FILE" in
    /workspace/agent/plans/*) exit 0 ;;
    /workspace/agent/reports/*) exit 0 ;;
    /workspace/agent/memory/*) exit 0 ;;
    /workspace/agent/conversations/*) exit 0 ;;
    /workspace/agent/fixes/*) exit 0 ;;
    /workspace/agent/reviews/*) exit 0 ;;
    /workspace/agent/critiques/*) exit 0 ;;
    /workspace/agent/CLAUDE.local.md) exit 0 ;;
    /workspace/.claude/*) exit 0 ;;
  esac

  DIR=$(dirname "$FILE")
  EXT="${FILE##*.}"
  if [ "$DIR" = "/workspace/agent" ] && { [ "$EXT" = "md" ] || [ "$EXT" = "json" ]; }; then
    exit 0
  fi
fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
mkdir -p "$(dirname "$STATE")"
[ -f "$STATE" ] || echo '{}' > "$STATE"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg ts "$NOW" '
  .edits_since_plan = ((.edits_since_plan // 0) + 1)
  | .edits_since_critique = ((.edits_since_critique // 0) + 1)
  | .last_edit_at = $ts
' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"

exit 0
