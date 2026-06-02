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

# Parse STAGE: marker from the codex prompt — only present on direct
# `mcp__codex__codex` calls (the entry point of a critique session).
# `mcp__codex__codex-reply` continuations don't carry STAGE; they inherit the
# parent thread's stage. We mark a stage as completed (count>=1) on the first
# call carrying it; iteration rounds bump critique_rounds for back-compat but
# don't double-count the stage.
#
# `|| true` is load-bearing: under `set -euo pipefail`, grep's exit-1 on
# no-match would propagate through the command substitution and abort the
# script before the jq update, leaving critique_rounds unincremented for
# codex-reply calls (which legitimately have no STAGE marker).
STAGE=$(echo "$PROMPT" | grep -oE 'STAGE:[[:space:]]*[A-Z_]+' | head -1 | sed -E 's/^STAGE:[[:space:]]*//' || true)

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [ -n "$STAGE" ]; then
  jq --arg ts "$NOW" --arg s "$STAGE" '
    .critique_rounds = ((.critique_rounds // 0) + 1)
    | .critique_stages = (.critique_stages // {})
    | .critique_stages[$s] = ((.critique_stages[$s] // 0) + 1)
    | .last_critique_stage = $s
    | .edits_since_critique = 0
    | .last_critique_at = $ts
  ' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
else
  jq --arg ts "$NOW" '
    .critique_rounds = ((.critique_rounds // 0) + 1)
    | .edits_since_critique = 0
    | .last_critique_at = $ts
  ' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
fi

# Surface a context reminder so the agent knows the round was recorded.
ROUNDS=$(jq -r '.critique_rounds' "$STATE")
STAGE_DONE=$(jq -r '(.critique_stages // {}) | to_entries | map("\(.key)=\(.value)") | join(", ") | if . == "" then "none" else . end' "$STATE" 2>/dev/null || echo "none")
jq -n --arg msg "Critique round $ROUNDS recorded (stages: $STAGE_DONE). Delivery gates open once every required stage has count >= 1." \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'

exit 0
