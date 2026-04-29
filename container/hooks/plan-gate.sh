#!/bin/bash
# PreToolUse hook (matcher: Edit|Write): block source code edits until a plan exists.
# Stdin: JSON with tool_name, tool_input.file_path, etc.
# Exit 0 = allow, exit 2 = deny (stderr shown to agent).
set -euo pipefail

STATE="/workspace/.claude/workflow-state.json"
INPUT=$(cat)

FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Allowlist: workspace files that don't need a plan
case "$FILE" in
  /workspace/agent/plans/*) exit 0 ;;
  /workspace/agent/reports/*) exit 0 ;;
  /workspace/agent/memory/*) exit 0 ;;
  /workspace/agent/conversations/*) exit 0 ;;
  /workspace/agent/fixes/*) exit 0 ;;
  /workspace/agent/CLAUDE.local.md) exit 0 ;;
  /workspace/.claude/*) exit 0 ;;
esac

# Allow .md and .json files directly under /workspace/agent/ (not subdirs)
DIR=$(dirname "$FILE")
EXT="${FILE##*.}"
if [ "$DIR" = "/workspace/agent" ] && { [ "$EXT" = "md" ] || [ "$EXT" = "json" ]; }; then
  exit 0
fi

# Everything else: check if a plan has been written for the current task
if [ ! -f "$STATE" ]; then
  echo "PLAN REQUIRED: Write a plan to /workspace/agent/plans/ before editing source code. Follow the plan-overlay gate in your workflow." >&2
  exit 2
fi

PLAN_WRITTEN=$(jq -r '.plan_written // false' "$STATE")
if [ "$PLAN_WRITTEN" != "true" ]; then
  echo "PLAN REQUIRED: Write a plan to /workspace/agent/plans/ before editing source code. Follow the plan-overlay gate in your workflow." >&2
  exit 2
fi

exit 0
