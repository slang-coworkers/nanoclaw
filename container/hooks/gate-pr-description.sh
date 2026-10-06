#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash), wired for every group: a PR description stays
# short. Squash merges copy the description into git log, so `gh pr create`,
# `gh pr edit` and `gh api …/pulls[/N]` may only set a description whose sections
# (a line starting with a bold label like `**Summary.**`, or a `## Heading`) hold
# at most PR_DESCRIPTION_MAX_SECTION_LINES non-empty lines each including the
# label line (default 2), whose total is at most PR_DESCRIPTION_MAX_CHARS
# characters (default 1000), and that carries no Markdown table. A trailing
# `<sub>…</sub>` disclaimer and `Fixes|Closes|Resolves #N` lines are not counted.
# Details, tables and open questions belong in the explanation comment
# (/explain-diff-html).
#
# The rules and the command parsing live in lib/pr_description.py; this wrapper
# only skips commands that cannot set a PR description, so python starts only
# when it has something to check.
#
# Stdin: hook JSON with tool_name, tool_input.command, cwd. Exit 0 = allow,
# exit 2 = deny with one line on stderr. Writes no state; never escalates.
# PR_DESCRIPTION_GATE=0 disables.
set -uo pipefail

[ "${PR_DESCRIPTION_GATE:-1}" = "0" ] && exit 0

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r 'if .tool_name == "Bash" then (.tool_input.command // "") else "" end' 2>/dev/null || true)
[ -n "$CMD" ] || exit 0

# Only `gh pr create|edit` and `gh api` with a pulls endpoint can set a description.
if grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+pr[[:space:]]+(create|edit)([[:space:]]|$)' <<< "$CMD"; then
  :
elif grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+api([[:space:]]|$)' <<< "$CMD" && grep -q 'pulls' <<< "$CMD"; then
  :
else
  exit 0
fi

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/pr_description.py"
