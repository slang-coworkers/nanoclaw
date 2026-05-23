#!/usr/bin/env bash
# PostToolUse hook (matcher: mcp__codex__codex|mcp__codex__codex-reply):
# every successful codex MCP call counts as a critique round, EXCEPT calls
# made by buddy (which we identify by signature in the prompt).
#
# Buddy's first codex call sends "You are Buddy" verbatim in its developer-
# instructions field; subsequent codex-reply calls send a "BATCH n (" header
# in the prompt. Either signature → not a critique. Anything else (including
# any other codex invocation a workflow might wire up later) → counts as a
# critique round.
#
# Stdin: JSON with tool_name, tool_input, tool_response. Exit 0 always.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$TOOL" in
  mcp__codex__codex|mcp__codex__codex-reply) ;;
  *) exit 0 ;;
esac

# Skip buddy invocations
DEV_INST=$(echo "$INPUT" | jq -r '.tool_input."developer-instructions" // .tool_input.developer_instructions // empty' 2>/dev/null | head -c 200)
PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null | head -c 500)
if echo "$DEV_INST" | grep -q "You are Buddy" 2>/dev/null; then exit 0; fi
if echo "$PROMPT"   | grep -qE "^BATCH [0-9]+ \(" 2>/dev/null; then exit 0; fi

# Skip error / timeout responses
RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty' 2>/dev/null | head -c 300)
if echo "$RESPONSE" | grep -qE '"error":|"is_error":\s*true|"timed[_ ]out"|^Error\b' 2>/dev/null; then exit 0; fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
mkdir -p "$(dirname "$STATE")"
[ -f "$STATE" ] || echo '{}' > "$STATE"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg ts "$NOW" '
  .critique_rounds = ((.critique_rounds // 0) + 1)
  | .edits_since_critique = 0
  | .last_critique_at = $ts
' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"

# Surface a context reminder so the agent knows the round was recorded.
ROUNDS=$(jq -r '.critique_rounds' "$STATE")
jq -n --arg msg "Critique round $ROUNDS recorded. Delivery gates (send_message [Fix Report]/[Resolution]/etc., gh pr create) now permit through this round." \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'

exit 0
