#!/bin/bash
# PostToolUse hook (matcher: Bash):
# Auto-detects PR creation from gh CLI or curl output and instructs the agent to
# call report_pr_created and run /explain-diff-html; on a `git push` it reminds
# the agent to refresh the explanation (the PR description) for the pushed head.
#
# Stdin: JSON with tool_name, tool_input, tool_response.
set -euo pipefail

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
[ "$TOOL" = "Bash" ] || exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // empty' 2>/dev/null)
# The Bash tool_response is an object ({stdout, stderr, ...}); git writes its push
# report to stderr. Decode both streams into plain lines for the push parser.
RESPONSE_TEXT=$(echo "$INPUT" | jq -r 'if (.tool_response | type) == "object"
  then ((.tool_response.stdout // "") + "\n" + (.tool_response.stderr // ""))
  else (.tool_response // "") end' 2>/dev/null || true)

# A push to a branch: the PR it backs (if any) now has a new head, and its
# description (the /explain-diff-html explanation) describes the old one. Read
# the repo, branch and new head from git's own push report — no network, and it
# names the ref that actually moved even when the command cd'd into a worktree:
#   To https://github.com/<owner>/<repo>.git
#      1a2b3c4..5d6e7f8  fix/issue-1 -> fix/issue-1      (or: + 1a2b..5d6e (forced update))
#    * [new branch]      fix/issue-1 -> fix/issue-1
case "$COMMAND" in
  *"git push"* | *"git -C "*" push"*)
    case "$COMMAND" in *"--dry-run"* | *" -n "*) exit 0 ;; esac
    PUSH_REPO=$(printf '%s\n' "$RESPONSE_TEXT" | sed -n 's#^To .*github\.com[:/]\([^/][^/]*/[^/ ]*\)$#\1#p' | sed 's#\.git$##' | head -n 1)
    PUSH_LINE=$(printf '%s\n' "$RESPONSE_TEXT" | grep -E '^ *[+* ]? *([0-9a-f]{7,}(\.\.\.?)[0-9a-f]{7,}|\[new branch\]) +[^ ]+ -> [^ ]+' | head -n 1 || true)
    PUSH_BRANCH=$(printf '%s\n' "$PUSH_LINE" | sed -E 's#.* -> ([^ ]+).*#\1#')
    PUSH_HEAD=$(printf '%s\n' "$PUSH_LINE" | sed -nE 's#^ *[+ ]? *[0-9a-f]{7,}\.\.\.?([0-9a-f]{7,}).*#\1#p')
    [ -n "$PUSH_REPO" ] && [ -n "$PUSH_BRANCH" ] || exit 0
    case "$PUSH_BRANCH" in refs/tags/* | v[0-9]*) exit 0 ;; esac
    jq -nc --arg repo "$PUSH_REPO" --arg branch "$PUSH_BRANCH" --arg head "${PUSH_HEAD:-the new head}" '{
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: ("Pushed " + $head + " to " + $repo + ":" + $branch + ". If that branch backs an open PR you own, re-run /explain-diff-html for it now so the PR description explains this head (upsert_pr_body.py refuses a stale head). Skip only a push that changes nothing a reader would notice, and say so in your report.")
      }
    }'
    exit 0
    ;;
esac

# Only check PR-creating commands
IS_PR_CREATE=false
case "$COMMAND" in
  *"gh pr create"*) IS_PR_CREATE=true ;;
esac
# curl POST to pulls API
if echo "$COMMAND" | grep -qP '(POST|post).*(/repos/|api\.github).*(/pulls)'; then
  IS_PR_CREATE=true
fi
if echo "$COMMAND" | grep -qP '(/repos/|api\.github).*(/pulls).*(POST|post)'; then
  IS_PR_CREATE=true
fi
[ "$IS_PR_CREATE" = "false" ] && exit 0

# Extract PR URL: https://github.com/<owner>/<repo>/pull/<number>
PR_URL=$(echo "$RESPONSE" | grep -oP 'https://github\.com/[^/]+/[^/]+/pull/\d+' | head -1)

if [ -z "$PR_URL" ]; then
  PR_URL=$(echo "$RESPONSE" | jq -r '.html_url // empty' 2>/dev/null | grep -oP 'https://github\.com/[^/]+/[^/]+/pull/\d+' || true)
fi

[ -z "$PR_URL" ] && exit 0

REPO=$(echo "$PR_URL" | grep -oP 'github\.com/\K[^/]+/[^/]+')
PR_NUM=$(echo "$PR_URL" | grep -oP '/pull/\K\d+')

[ -z "$REPO" ] || [ -z "$PR_NUM" ] && exit 0

# Output instruction for the agent: (1) claim the PR for webhook routing,
# (2) produce the HTML explanation that accompanies every PR we open
# (container/skills/explain-diff-html — in base-common, so every project
# spine has it). The hookSpecificOutput.additionalContext is injected into
# the agent's next turn.
jq -nc --arg repo "$REPO" --arg pr "$PR_NUM" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("PR created: " + $repo + "#" + $pr + ". IMPORTANT: Call report_pr_created(repo=\"" + $repo + "\", pr_number=" + $pr + ") now so webhook events for this PR route to your session. Then run /explain-diff-html for " + $repo + "#" + $pr + ": write the self-contained HTML under /workspace/agent/reports/pr-explanations/, deliver it with send_file to the thread that asked for this PR, make the same content the PR description with its upsert_pr_body.py (GitHub-safe Markdown, rewritten for the new head on every later push), and list the file path in the review request or report that follows. Never post the file path or internal URLs to GitHub.")
  }
}'

exit 0
