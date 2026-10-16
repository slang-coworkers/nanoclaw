#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash|mcp__slang-mcp__discord_send_message|
# mcp__slang-mcp__github_create_or_update_file): keep an evaluation copy of a
# coworker from writing anywhere but the evaluation fork.
#
# Symmetric opt-in, like gate-critique-on-deliver.sh: the hook only fires for
# groups whose overlays include `eval-sandbox`. The composer materializes
# /workspace/agent/.overlay-eval-sandbox from that overlay's MARKER, and the
# host passes EVAL_SANDBOX_ACTIVE=1/0 from the same file before the container
# exists, so the agent cannot switch the gate off by deleting the marker.
#
# What is refused, with a reason on stderr and exit 2:
#   - the two MCP tools that reach humans or write repository files directly
#     (Discord send, GitHub create-or-update-file);
#   - any Bash command that would write to a GitHub repository outside
#     EVAL_ALLOWED_REPOS (default slang-coworkers/slang-eval): mutating `gh pr`
#     / `gh issue` / `gh repo` / `gh release` ... subcommands, `gh api` with a
#     non-GET method or -f/-F fields, `git push` to a remote whose URL is not an
#     allowed repo, and curl/wget/python/node calls to api.github.com that
#     mutate (the same method/field shapes gate-critique-on-deliver.sh
#     recognises). GraphQL mutations are refused outright because their target
#     cannot be read from the command.
# Everything that only reads stays allowed. The classification lives in
# lib/eval_sandbox.py so it can be unit-tested; this script handles activation,
# the MCP tools and the fail-closed path when python3 is missing.
set -euo pipefail

OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
if [ -n "${EVAL_SANDBOX_ACTIVE:-}" ]; then
  [ "$EVAL_SANDBOX_ACTIVE" = "1" ] || exit 0
else
  [ -f "$OVERLAY_DIR/.overlay-eval-sandbox" ] || exit 0
fi

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
ALLOWED="${EVAL_ALLOWED_REPOS:-slang-coworkers/slang-eval}"

deny() {
  cat >&2 << EOF
EVAL SANDBOX: refused $1.

This coworker is an evaluation copy. It may write only to: $ALLOWED.
Reads (gh ... view/list, gh api GET, git fetch) are allowed. Deliver results as
files under /workspace/agent/eval/<task-id>/ or as a branch and draft PR on the
fork; never message a human or touch another repository.
EOF
  exit 2
}

case "$TOOL" in
  mcp__slang-mcp__discord_send_message)
    deny "a Discord message: an evaluation copy never messages humans"
    ;;
  mcp__slang-mcp__github_create_or_update_file)
    # The tool writes a file straight to a repository with no command line to
    # inspect for the target, so it is refused regardless of its arguments.
    deny "github_create_or_update_file: repository writes go through git push to the fork, where the target can be checked"
    ;;
  Bash) ;;
  *) exit 0 ;;
esac

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
# Only commands that can reach GitHub need the classifier; everything else is
# local work and passes without spawning python.
if ! grep -qiE '(^|[^[:alnum:]_./-])gh([[:space:]]|$)|git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?push|github\.com' <<< "$COMMAND"; then
  exit 0
fi

LIB="$(dirname "${BASH_SOURCE[0]}")/lib/eval_sandbox.py"
if ! command -v python3 > /dev/null 2>&1 || [ ! -f "$LIB" ]; then
  # Fail closed: a GitHub-reaching command that cannot be classified is refused
  # rather than let through, because the whole point of the gate is that the
  # fork is the only writable target.
  deny "a GitHub-reaching command that could not be classified (python3 or lib/eval_sandbox.py missing)"
fi

set +e
REASON=$(printf '%s' "$INPUT" | EVAL_ALLOWED_REPOS="$ALLOWED" python3 "$LIB" 2>&1 >/dev/null)
rc=$?
set -e
case "$rc" in
  0) exit 0 ;;
  2) deny "${REASON:-a write outside the allowed repositories}" ;;
  *) deny "a GitHub-reaching command the classifier could not parse (exit $rc): ${REASON}" ;;
esac
