#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash), wired for every group: text that other people
# read follows the slang-ste-writing skill. `gh pr create|edit` and
# `gh issue create|edit|comment` bodies are run through the skill's checker
# (scripts/ste_check.py) when that skill is installed in the group; a body with
# findings is refused with one line naming up to three of them. Groups without
# the skill are not checked. The parsing lives in lib/ste_gate.py (which reuses
# lib/pr_description.py to read the body from the command); this wrapper only
# skips commands that cannot set such text, so python starts only when needed.
#
# Stdin: hook JSON with tool_name, tool_input.command, cwd. Exit 0 = allow,
# exit 2 = deny with one line on stderr. Writes no state; never escalates.
# STE_WRITING_GATE=0 disables; STE_CHECK=<path> overrides the checker location.
set -uo pipefail

[ "${STE_WRITING_GATE:-1}" = "0" ] && exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r 'if .tool_name == "Bash" then (.tool_input.command // "") else "" end' 2>/dev/null || true)
[ -n "$CMD" ] || exit 0

grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+(pr[[:space:]]+(create|edit)|issue[[:space:]]+(create|edit|comment))([[:space:]]|$)' <<< "$CMD" || exit 0

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/ste_gate.py"
