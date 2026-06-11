#!/usr/bin/env bash
# PreToolUse hook (matcher: mcp__codex__codex):
# Reject codex critique calls that use sandbox != "danger-full-access".
# bwrap does not work inside Docker containers, so read-only/standard
# sandboxing always fails. Force the agent to pass the correct value
# on the first try instead of wasting a round-trip.
#
# Stdin: JSON with tool_name, tool_input. Exit 0 = allow, exit 2 = deny.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  mcp__codex__codex) ;;
  *) exit 0 ;;
esac

SANDBOX=$(echo "$INPUT" | jq -r '.tool_input.sandbox // "danger-full-access"')

if [ "$SANDBOX" != "danger-full-access" ]; then
  cat >&2 << 'EOF'
BLOCKED: sandbox must be "danger-full-access" for codex critique.

bwrap sandboxing does not work inside Docker containers — "read-only"
and other modes will fail with "No permissions to create a new namespace".
Retry this call with sandbox: "danger-full-access".
EOF
  exit 2
fi

exit 0
