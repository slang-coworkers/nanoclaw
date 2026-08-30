#!/bin/bash
# UserPromptSubmit hook: inject buddy guidance into the primary's next turn.
# Reads $WS_AGENT/.buddy-guidance and prepends as <buddy-note> if present.
# The buddy background agent writes to this file when codex flags a concern.

# Env-addressable workspace roots so hooks work both in Docker (where
# /workspace is mounted) and AGENT_RUNTIME=local (where the bun child carries
# WORKSPACE_SESSION/WORKSPACE_AGENT pointing at the session and group dirs).
WS_SESSION="${WORKSPACE_SESSION:-/workspace}"
WS_AGENT="${WORKSPACE_AGENT:-/workspace/agent}"

GUIDANCE="$WS_AGENT/.buddy-guidance"

if [ -f "$GUIDANCE" ] && [ -s "$GUIDANCE" ]; then
  CONTENT=$(cat "$GUIDANCE")
  # Output to stdout — Claude SDK prepends this to the user prompt
  echo "<buddy-note>$CONTENT</buddy-note>"
  # Clear after injection (atomic: write empty, then remove)
  > "$GUIDANCE"
fi
