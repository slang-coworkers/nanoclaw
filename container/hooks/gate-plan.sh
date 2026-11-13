#!/usr/bin/env bash
# PreToolUse hook (matcher: Edit|Write|MultiEdit|NotebookEdit|Bash; Codex: Bash):
# block source-code edits until a plan exists. A Codex `apply_patch` call
# arrives as Bash and is judged by the files it writes (lib/plan-paths.sh). Critique enforcement moved
# to gate-critique-on-deliver.sh — this hook is now plan-only.
#
# Symmetric opt-in (Model A, mirrors gate-critique-on-deliver.sh): only
# fires for coworkers whose overlays include `plan-gate`. The composer
# materializes the marker file at /workspace/agent/.overlay-plan-gate;
# this hook checks for it first and exits 0 (no-op) when absent. Coworkers
# without the overlay (readers, triagers, reviewers, casual chat agents)
# can still run Edit/Write/Bash without enforcement — opt-in by design.
#
# Subagents share the parent's workflow-state.json, so the parent's plan covers
# them through the same check; they get no separate pass. (CLAUDE_CODE_FORK_SUBAGENT
# is a Claude SDK feature switch the host forwards to every container, so it
# never meant "this call comes from a subagent", and keying on it turned the
# gate off for every group of an install that set it.)
#
# Stdin: JSON with tool_name, tool_input.file_path or tool_input.command.
# Exit 0 = allow, exit 2 = deny (stderr shown to agent).
set -euo pipefail

# Opt-in gate — overlay-marker check (Model A symmetric opt-in).
# Path is overridable for testing; container default is /workspace/agent/.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
[ -f "$OVERLAY_DIR/.overlay-plan-gate" ] || exit 0

# shellcheck source=lib/plan-paths.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/plan-paths.sh"

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

# --- Bash: a Codex patch by its files; anything else by write patterns ---
if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  [ -z "$CMD" ] && exit 0
  if is_apply_patch "$CMD"; then
    HOOK_CWD=$(echo "$INPUT" | jq -r '.cwd // "/workspace/agent"')
    NEEDS_PLAN=false
    while IFS= read -r FILE; do
      [ -n "$FILE" ] && ! plan_free_path "$FILE" && NEEDS_PLAN=true
    done <<< "$(apply_patch_files "$CMD" "$HOOK_CWD")"
    [ "$NEEDS_PLAN" = "false" ] && exit 0
  else
    IS_WRITE=false
    if echo "$CMD" | grep -qP '(^|\s|\|)(>|>>)\s'; then
      IS_WRITE=true
    elif echo "$CMD" | grep -qP '\b(tee|sed\s+-i|patch\s|git\s+apply|git\s+am|dd\s)\b'; then
      IS_WRITE=true
    fi
    [ "$IS_WRITE" = "false" ] && exit 0
  fi
else
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
  [ -z "$FILE" ] && exit 0
  # Workspace files that don't need a plan (lib/plan-paths.sh)
  plan_free_path "$FILE" && exit 0
fi

# OVERLAY_HAS_PLAN was used by the legacy plan-gate.sh to opt out of plan
# enforcement on coworkers without the plan workflow. Since plan is now the
# standard for every code-touching coworker, the gate is unconditional.
# Set OVERLAY_HAS_PLAN=0 to disable for one-off bring-up scenarios.
HAS_PLAN="${OVERLAY_HAS_PLAN:-1}"
[ "$HAS_PLAN" != "1" ] && exit 0

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

# A plan counts only while its file exists. Codex records a plan before the
# patch that writes it runs (plan-tracker.sh), and it runs parallel tool calls:
# a code patch in the same batch must not pass on a plan that is not written yet.
PLAN_PATH=$(jq -r '.plan_path // empty' "$STATE" 2>/dev/null || true)
if [ ! -f "$STATE" ] || [ "$(jq -r '.plan_written // false' "$STATE" 2>/dev/null)" != "true" ] \
  || { [ -n "$PLAN_PATH" ] && [ ! -f "$PLAN_PATH" ]; }; then
  cat >&2 << 'EOF'
PLAN REQUIRED: Write a plan before editing source code.

HOW TO PROCEED:
1. Write plan to /workspace/agent/reports/<target-slug>.md (files, approach, verification).
2. Invoke /codex-critique to review the plan.
3. Then edit source code following the plan.
EOF
  exit 2
fi

# A written plan stays valid until the task state resets. Edits since the plan
# are counted (track-edits.sh) for the dashboard only; the critique gate checks
# the work at delivery instead.
exit 0
