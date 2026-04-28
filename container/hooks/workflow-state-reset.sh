#!/bin/bash
# UserPromptSubmit hook: reset workflow state when a new task arrives.
# Stdin: JSON with hook_event_name, prompt text, etc.
# A new task resets plan_written/critique_rounds so old plans don't satisfy the gate.
set -euo pipefail

STATE="/workspace/.claude/workflow-state.json"
INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
[ -z "$PROMPT" ] && exit 0

# Skip /clear and system messages — they're not new tasks
echo "$PROMPT" | grep -qi '^/clear' && exit 0
echo "$PROMPT" | grep -qi '^<context' && {
  # Check if the context block has a real message inside
  echo "$PROMPT" | grep -qi '<message' || exit 0
}

mkdir -p "$(dirname "$STATE")"
TASK_ID="task-$(date +%s)-$RANDOM"
jq -n \
  --arg id "$TASK_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{task_id: $id, plan_written: false, plan_path: null, critique_rounds: 0, started_at: $ts}' \
  > "$STATE"

exit 0
