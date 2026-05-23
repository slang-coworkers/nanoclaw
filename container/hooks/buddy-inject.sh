#!/usr/bin/env bash
# UserPromptSubmit hook: inject buddy guidance into the primary agent's
# next turn. Reads /workspace/.claude/buddy/guidance.txt; if non-empty,
# emits as additionalContext wrapped in <buddy-note> tags, then truncates
# the file so the same note doesn't get injected twice.
#
# Session-scoped: /workspace is a per-session container mount, so two
# concurrent sessions for the same agent group keep independent buddy
# state. The legacy path /workspace/agent/.buddy-guidance was group-shared
# across sessions and is no longer used.
#
# Stdin: JSON event payload (we don't read it). Exit 0 always.
set -euo pipefail

GUIDANCE="/workspace/.claude/buddy/guidance.txt"

if [ -s "$GUIDANCE" ]; then
  NOTE=$(cat "$GUIDANCE")
  jq -n --arg note "$NOTE" '
    {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: ("<buddy-note>" + $note + "</buddy-note>")
      }
    }
  '
  # Truncate after injection — buddy-call.sh appends to a known path next time.
  : > "$GUIDANCE"
fi

exit 0
