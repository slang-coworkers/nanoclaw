#!/usr/bin/env bash
# PreToolUse hook (matcher: Edit|Write|MultiEdit|NotebookEdit|Bash):
# block source-code edits until a plan exists. Critique enforcement moved
# to gate-critique-on-deliver.sh — this hook is now plan-only.
#
# Subagents (CLAUDE_CODE_FORK_SUBAGENT=1) inherit the parent's plan; they
# pass this gate. Their deliveries are still gated by gate-critique-on-deliver.sh
# the same as the parent — that's where universal critique enforcement lives.
#
# Stdin: JSON with tool_name, tool_input.file_path or tool_input.command.
# Exit 0 = allow, exit 2 = deny (stderr shown to agent).
set -euo pipefail

# Subagents skip plan check
[ "${CLAUDE_CODE_FORK_SUBAGENT:-0}" = "1" ] && exit 0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

# --- Bash: heuristic write-pattern detection ---
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

  # Allowlist: workspace files that don't need a plan
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

# OVERLAY_HAS_PLAN was used by the legacy plan-gate.sh to opt out of plan
# enforcement on coworkers without the plan workflow. Since plan is now the
# standard for every code-touching coworker, the gate is unconditional.
# Set OVERLAY_HAS_PLAN=0 to disable for one-off bring-up scenarios.
HAS_PLAN="${OVERLAY_HAS_PLAN:-1}"
[ "$HAS_PLAN" != "1" ] && exit 0

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

if [ ! -f "$STATE" ] || [ "$(jq -r '.plan_written // false' "$STATE" 2>/dev/null)" != "true" ]; then
  cat >&2 << 'EOF'
PLAN REQUIRED: Write a plan before editing source code.

HOW TO PROCEED:
1. Write plan to /workspace/agent/reports/<target-slug>.md (files, approach, verification).
2. Invoke /codex-critique to review the plan.
3. Then edit source code following the plan.
EOF
  exit 2
fi

# Plan staleness check stays — many edits since last plan-write means the
# plan no longer reflects the work being done.
PLAN_STALE=$(jq -r '.plan_stale // false' "$STATE" 2>/dev/null || echo false)
if [ "$PLAN_STALE" = "true" ]; then
  EDITS=$(jq -r '.edits_since_plan // 0' "$STATE" 2>/dev/null || echo 0)
  echo "PLAN STALE: $EDITS edits since last plan. Refresh the plan in /workspace/agent/reports/ before continuing." >&2
  exit 2
fi

exit 0
