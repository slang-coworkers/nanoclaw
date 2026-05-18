#!/bin/bash
# UserPromptSubmit hook: inject buddy guidance into the primary's next turn.
# Reads /workspace/agent/.buddy-guidance and prepends as <buddy-note> if present.
# The buddy background agent writes to this file when codex flags a concern.

GUIDANCE="/workspace/agent/.buddy-guidance"

if [ -f "$GUIDANCE" ] && [ -s "$GUIDANCE" ]; then
  CONTENT=$(cat "$GUIDANCE")
  # Output to stdout — Claude SDK prepends this to the user prompt
  echo "<buddy-note>$CONTENT</buddy-note>"
  # Clear after injection (atomic: write empty, then remove)
  > "$GUIDANCE"
fi
