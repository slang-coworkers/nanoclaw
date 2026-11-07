#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|mcp__github__.*|mcp__slang-mcp__github_.*): keep a
# coworker from writing to a GitHub issue that people have opted out of
# (contributor standard R6, "the bot leaves room for people").
#
# The host writes /workspace/agent/.issue-opt-outs.json into every agent group
# folder whenever an issue is opted out (a GoodFirstBug, HelpWanted or no-bot
# label, or a comment telling the bot to stop) or released (the last such label
# removed); see src/issue-opt-out.ts. This hook reads that list and refuses, with
# a reason on stderr and exit 2, any tool call that would write to GitHub and
# names an opted-out issue: a comment on it, a PR or branch for it, an edit or
# close of it, a `gh api` write on its path. Reads stay allowed, and so does
# every write that names no opted-out issue. The classification lives in
# lib/issue_optout.py so it can be unit-tested; this script handles the cheap
# exits and the fail-closed path when python3 is missing.
set -uo pipefail

[ "${ISSUE_OPT_OUT_GATE:-1}" = "0" ] && exit 0

LIST="${ISSUE_OPT_OUT_LIST:-${OVERLAY_MARKER_DIR:-/workspace/agent}/.issue-opt-outs.json}"
[ -s "$LIST" ] || exit 0
grep -q '"number"' "$LIST" 2>/dev/null || exit 0

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)
case "$TOOL" in
  Bash|mcp__github__*|mcp__slang-mcp__github_*) ;;
  *) exit 0 ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  # Without python3 the command cannot be classified. A call that looks like it
  # reaches GitHub is refused (fail closed); anything else passes.
  if printf '%s' "$INPUT" | grep -qE 'gh[[:space:]]|git[[:space:]]+push|github\.com|mcp__'; then
    echo "ISSUE OPT-OUT GATE: python3 is missing, so this GitHub call cannot be checked against the opt-out list; refused." >&2
    exit 2
  fi
  exit 0
fi

printf '%s' "$INPUT" | ISSUE_OPT_OUT_LIST="$LIST" python3 "$(dirname "${BASH_SOURCE[0]}")/lib/issue_optout.py"
