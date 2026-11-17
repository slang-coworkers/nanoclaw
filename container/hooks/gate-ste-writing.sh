#!/usr/bin/env bash
# PreToolUse hook (matchers: Bash, the GitHub MCP write tools, the Discord and
# Slack send tools), wired for every group: text that other people read follows
# the slang-ste-writing skill. PR, issue, comment and review bodies set from
# Bash (`gh pr|issue …`, `gh api …`), the GitHub MCP tools' body fields, and
# chat posts are run through the skill's checker (scripts/ste_check.py) when
# that skill is installed in the group; text with findings is refused with one
# line naming up to three of them. A chat post that is a numbered part of a
# split message ("(part k/N)") is refused in every group: one post per topic,
# the rest in its thread. Groups without the skill get only that check. The parsing lives in lib/ste_gate.py (which reuses
# lib/pr_description.py to read the body from the command); this wrapper only
# skips commands that cannot set such text, so python starts only when needed.
#
# Stdin: hook JSON with tool_name, tool_input.command, cwd. Exit 0 = allow,
# exit 2 = deny with one line on stderr. Writes no state; never escalates.
# STE_WRITING_GATE=0 disables; STE_CHECK=<path> overrides the checker location.
set -uo pipefail

[ "${STE_WRITING_GATE:-1}" = "0" ] && exit 0

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)
case "$TOOL" in
  Bash) ;;
  mcp__*)
    command -v python3 >/dev/null 2>&1 || exit 0
    printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/ste_gate.py"
    exit $?
    ;;
  *) exit 0 ;;
esac
CMD=$(printf '%s' "$INPUT" | jq -r 'if .tool_name == "Bash" then (.tool_input.command // "") else "" end' 2>/dev/null || true)
[ -n "$CMD" ] || exit 0

grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+(pr[[:space:]]+(create|edit|comment|review)|issue[[:space:]]+(create|edit|comment)|api)([[:space:]]|$)' <<< "$CMD" || exit 0

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/ste_gate.py"
