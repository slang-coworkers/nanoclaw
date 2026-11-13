#!/bin/bash
# Detect plan file writes and update state.
#   Claude: PostToolUse hook (matcher: Write), with tool_input.file_path.
#   Codex:  PreToolUse hook (matcher: Bash), for an `apply_patch` call. Codex
#           sends no PostToolUse for a patch (measured, codex 0.160), so the
#           write is recorded before it runs. It is recorded only when every
#           file of the patch needs no plan: such a patch is never refused by
#           gate-plan.sh, so a refused patch cannot leave a plan on record.
# Stdin: JSON with tool_name, tool_input.file_path or tool_input.command.
set -euo pipefail

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
INPUT=$(cat)

# shellcheck source=lib/plan-paths.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/plan-paths.sh"

FILE=""
if [ "$(echo "$INPUT" | jq -r '.tool_name // empty')" = "Bash" ]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  is_apply_patch "$CMD" || exit 0
  HOOK_CWD=$(echo "$INPUT" | jq -r '.cwd // "/workspace/agent"')
  while IFS= read -r F; do
    [ -z "$F" ] && continue
    plan_free_path "$F" || exit 0
    case "$F" in /workspace/agent/reports/* | /workspace/agent/plans/*) [ -z "$FILE" ] && FILE="$F" ;; esac
  done <<< "$(apply_patch_files "$CMD" "$HOOK_CWD")"
else
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
fi
[ -z "$FILE" ] && exit 0

# Tracks two kinds of writes:
#   /workspace/agent/reports/*   → marks plan_written, resets edits_since_plan
#     (the /plan workflow's `produces` path; `plans/` kept as a legacy alias)
#   /workspace/agent/critiques/* → marks the active critique round as recorded
case "$FILE" in
  /workspace/agent/reports/*|/workspace/agent/plans/*)
    mkdir -p "$(dirname "$STATE")"
    if [ -f "$STATE" ]; then
      jq --arg path "$FILE" \
        '.plan_written = true | .plan_path = $path | .plan_stale = false | .edits_since_plan = 0' \
        "$STATE" > "${STATE}.tmp" \
        && mv "${STATE}.tmp" "$STATE"
    else
      jq -n --arg path "$FILE" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{task_id: "unknown", plan_written: true, plan_path: $path, plan_stale: false, edits_since_plan: 0, critique_required: false, critique_rounds: 0, critique_round_at_flag: 0, edits_since_critique: 0, started_at: $ts}' \
        > "$STATE"
    fi
    ;;
  *) exit 0 ;;
esac

# Reset denial counters so next denial is verbose again
DENIAL_COUNT_FILE="$(dirname "$STATE")/denial-counts.json"
if [ -f "$DENIAL_COUNT_FILE" ]; then
  jq '.plan_required = 0 | .plan_stale = 0' "$DENIAL_COUNT_FILE" > "${DENIAL_COUNT_FILE}.tmp" \
    && mv "${DENIAL_COUNT_FILE}.tmp" "$DENIAL_COUNT_FILE"
fi

exit 0
