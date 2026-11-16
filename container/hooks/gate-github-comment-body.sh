#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash plus the GitHub MCP comment and review tools), wired for
# every group: a GitHub comment, review or issue/PR body is refused when GitHub would show
# it broken. Two shapes are refused:
#   - the whole body is `@<path>` given where gh sends the text as it is (-b/--body,
#     `gh api -f body=@…`), so the comment reads "@/tmp/comment.md";
#   - the body opens with a YAML frontmatter block (`---`, `key: value` lines, `---`),
#     a memo file posted as it is.
# The refusal names the form that works: --body-file <path>, or `gh api … -F body=@<path>`,
# with the frontmatter stripped first.
#
# The checks and the command parsing live in lib/github_comment_body.py (it shares the
# parser of lib/pr_description.py); this wrapper only skips tool calls that cannot post a
# body, so python starts only when it has something to check.
#
# Stdin: hook JSON with tool_name, tool_input, cwd. Exit 0 = allow, exit 2 = deny with one
# line on stderr. Writes no state. GITHUB_COMMENT_BODY_GATE=0 disables.
set -uo pipefail

[ "${GITHUB_COMMENT_BODY_GATE:-1}" = "0" ] && exit 0

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)

case "$TOOL" in
  Bash)
    CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || true)
    # Only `gh issue|pr comment|review|create|edit` and `gh api` post a body.
    grep -qE '(^|[^[:alnum:]_.-])gh[[:space:]]+((issue|pr)[[:space:]]+(comment|review|create|edit)|api)([[:space:]]|$)' <<< "$CMD" || exit 0
    ;;
  mcp__github__*) ;;
  *) exit 0 ;;
esac

command -v python3 >/dev/null 2>&1 || exit 0
printf '%s' "$INPUT" | python3 "$(dirname "${BASH_SOURCE[0]}")/lib/github_comment_body.py"
