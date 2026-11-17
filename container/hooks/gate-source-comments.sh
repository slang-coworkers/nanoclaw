#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash), wired for every group: a `git commit` may not add a
# source comment that carries process or history (issue and PR numbers, "before this
# change", "fixes #N") or the deprecated `ConstRef` term for a `borrow in`. A comment
# documents the code as it stands; references belong in the commit message and the PR.
#
# The rules and the diff reading live in lib/source_comments.py; this wrapper only
# skips commands that are not a git commit, so python starts only when there is a
# commit to check. Stdin: hook JSON with tool_name, tool_input.command, cwd.
# Exit 0 = allow, exit 2 = deny with one line on stderr. Writes no state; never
# escalates. SOURCE_COMMENT_GATE=0 disables.
set -uo pipefail

[ "${SOURCE_COMMENT_GATE:-1}" = "0" ] && exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r 'if .tool_name == "Bash" then (.tool_input.command // "") else "" end' 2>/dev/null || true)
[ -n "$CMD" ] || exit 0

grep -qE '(^|[^[:alnum:]_./-])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)' <<< "$CMD" || exit 0

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/source_comments.py"
