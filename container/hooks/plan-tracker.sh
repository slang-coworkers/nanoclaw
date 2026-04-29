#!/bin/bash
# PostToolUse hook (matcher: Write): detect plan file writes and update state.
# Stdin: JSON with tool_name, tool_input.file_path, tool_response, etc.
set -euo pipefail

STATE="/workspace/.claude/workflow-state.json"
INPUT=$(cat)

FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] && exit 0

# Only track writes to the plans directory
case "$FILE" in
  /workspace/agent/plans/*) ;;
  *) exit 0 ;;
esac

mkdir -p "$(dirname "$STATE")"

if [ -f "$STATE" ]; then
  jq --arg path "$FILE" '.plan_written = true | .plan_path = $path' "$STATE" > "${STATE}.tmp" \
    && mv "${STATE}.tmp" "$STATE"
else
  jq -n --arg path "$FILE" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{task_id: "unknown", plan_written: true, plan_path: $path, critique_rounds: 0, started_at: $ts}' \
    > "$STATE"
fi

exit 0
