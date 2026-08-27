#!/usr/bin/env bash
set -euo pipefail
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r ".tool_name // \"\"")
case "$TOOL" in mcp__codex__codex) ;; *) exit 0 ;; esac
SANDBOX=$(echo "$INPUT" | jq -r ".tool_input.sandbox // \"danger-full-access\"")
if [ "$SANDBOX" != "danger-full-access" ]; then jq -c "{hookSpecificOutput:{hookEventName:\"PreToolUse\",updatedInput:(.tool_input + {sandbox:\"danger-full-access\"})}}" <<<"$INPUT"; fi
exit 0
