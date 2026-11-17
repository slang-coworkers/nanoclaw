#!/bin/bash
# UserPromptSubmit hook: reset workflow state when a new task arrives.
# Stdin: JSON with hook_event_name, prompt text, etc.
# A new task resets plan_written/critique_rounds so old plans don't satisfy the gate.
#
# Detection strategy (ordered by reliability):
# 1. Router envelope (<context> + <message>) — always a new routed task → full reset
# 2. Workflow invocation (/plan, /implement, or project variants like /slang-implement) → full reset
# 3. Idle timer (>10min since the task's latest edit or critique round) → full reset,
#    except for a prompt that carries only host notifications
# 4. Otherwise — follow-up message within same task → no reset
set -euo pipefail

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
INPUT=$(cat)

# A subagent must not reset the parent's state: they share workflow-state.json,
# and the subagent works within the parent's task. Claude Code marks a hook call
# made inside a subagent with `agent_id`. (CLAUDE_CODE_FORK_SUBAGENT is a Claude
# SDK feature switch the host forwards to every container, so keying on it
# skipped every reset of an install that set it, and one task's critique
# rounds then counted for the next task.)
[ -n "$(echo "$INPUT" | jq -r '.agent_id // empty' 2>/dev/null)" ] && exit 0

PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
[ -z "$PROMPT" ] && exit 0

# Skip /clear — it's a context wipe, not a new task
echo "$PROMPT" | grep -qi '^/clear' && exit 0

do_reset() {
  mkdir -p "$(dirname "$STATE")"
  TASK_ID="task-$(date +%s)-$RANDOM"
  jq -n \
    --arg id "$TASK_ID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{task_id: $id, plan_written: false, plan_path: null, edits_since_plan: 0, critique_required: false, critique_rounds: 0, critique_round_at_flag: 0, edits_since_critique: 0, started_at: $ts, last_activity_at: $ts}' \
    > "$STATE"
  exit 0
}

# Signal 1: NanoClaw router envelope — always a new task
if echo "$PROMPT" | grep -q '<context' && echo "$PROMPT" | grep -q '<message'; then
  do_reset
fi

# Signal 2: Workflow invocation at the start of the prompt. Matches the base
# workflows (/plan, /implement) and any project-specific variant whose name
# ends in one of those suffixes. The `[a-z0-9-]*-` prefix is non-capturing
# and allows multi-segment names like /nv-graphics-implement, not just the
# single-prefix /slang-implement.
if echo "$PROMPT" | grep -qP '^\s*/([a-z0-9-]+-)?(plan|implement)\b'; then
  do_reset
fi

# If no state file exists, create fresh state for the first task
[ ! -f "$STATE" ] && do_reset

# A prompt that carries only host notifications (a critique-gate nudge, a saved
# learning, a container-restart notice) is the host talking about the work in
# progress, so it never starts a new task. A routed message renders as
# <message> and a scheduled task as <task>; either one keeps the idle check.
# Without this, the gate's own nudge erased the critique round it asked for.
if grep -q '<system-notification' <<< "$PROMPT" && ! grep -qE '<message|<task' <<< "$PROMPT"; then
  exit 0
fi

# Signal 3: Idle timer — a prompt that arrives 10 minutes or more after the
# task's latest recorded activity starts a new task. Activity is the latest of
# the task start, an edit (last_edit_at, track-edits.sh) and a critique round
# (last_critique_at, track-critique.sh). All three use one UTC format, so the
# lexicographic max is the latest time.
LAST_ACTIVE=$(jq -r '[.last_activity_at, .last_edit_at, .last_critique_at, .started_at]
  | map(select(type == "string" and . != "")) | max // empty' "$STATE")
if [ -n "$LAST_ACTIVE" ]; then
  ACTIVE_EPOCH=$(date -d "$LAST_ACTIVE" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  IDLE=$(( NOW_EPOCH - ACTIVE_EPOCH ))
  if [ "$IDLE" -ge 600 ]; then
    do_reset
  fi
fi

# Follow-up message within the same task — no reset
exit 0
