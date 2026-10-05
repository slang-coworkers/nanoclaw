#!/bin/bash
# PostToolUse hook (matcher: Bash):
# Auto-detects PR creation from gh CLI or curl output and instructs the agent to
# call report_pr_created and run /explain-diff-html; on a `git push` it reminds
# the agent to refresh the explanation (the PR's explanation comment) for the pushed head.
#
# It also keeps the receipts the refresh gates read (lib/explain-diff-owed.sh):
# a PR created, a branch pushed, an explanation comment written by upsert_pr_body.py.
# Receipts are best effort — a write failure never changes the reminder.
#
# Stdin: JSON with tool_name, tool_input, tool_response.
# shellcheck disable=SC2016  # the single-quoted $names are jq variables
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

HOOK_DIR=$(dirname "${BASH_SOURCE[0]}")
# shellcheck source=lib/explain-diff-owed.sh
[ -f "$HOOK_DIR/lib/explain-diff-owed.sh" ] && . "$HOOK_DIR/lib/explain-diff-owed.sh"
STATE_FILE="${EXPLAIN_DIFF_STATE:-${EXPLAIN_DIFF_STATE_FILE:-/workspace/.claude/explain-diff-state.json}}"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Apply one jq update to the receipts file after bumping its seq counter.
# Usage: record '<filter>' [jq --arg ...]. `.seq` inside the filter is the
# bumped value. Never fails the hook.
record() {
  local filter="$1" cur='{}'
  shift
  mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null || return 0
  if [ -s "$STATE_FILE" ] && jq -e 'type == "object"' "$STATE_FILE" >/dev/null 2>&1; then
    cur=$(cat "$STATE_FILE")
  fi
  if jq --arg now "$NOW" "$@" '.seq = ((.seq // 0) + 1) | '"$filter" <<< "$cur" > "$STATE_FILE.tmp.$$" 2>/dev/null; then
    mv "$STATE_FILE.tmp.$$" "$STATE_FILE" 2>/dev/null || rm -f "$STATE_FILE.tmp.$$" 2>/dev/null || true
  else
    rm -f "$STATE_FILE.tmp.$$" 2>/dev/null || true
  fi
  return 0
}

# A literal value from the command, or empty when it is a shell expansion the
# hook cannot see through ("$R", "$(...)").
literal() {
  case "$1" in *'$'* | *'`'*) printf '' ;; *) printf '%s' "$1" ;; esac
}

PUSH_MSG=""
CREATE_MSG=""
EXPLAINED=""

# A push to a branch: the PR it backs (if any) now has a new head, and its
# description (the /explain-diff-html explanation) describes the old one. Read
# the repo, branch and new head from git's own push report — no network, and it
# names the ref that actually moved even when the command cd'd into a worktree:
#   To https://github.com/<owner>/<repo>.git
#      1a2b3c4..5d6e7f8  fix/issue-1 -> fix/issue-1      (or: + 1a2b..5d6e (forced update))
#    * [new branch]      fix/issue-1 -> fix/issue-1
case "$COMMAND" in
  *"git push"* | *"git -C "*" push"*)
    case "$COMMAND" in
      *"--dry-run"* | *" -n "*) ;;
      *)
        PUSH_REPO=$(printf '%s\n' "$RESPONSE_TEXT" | sed -n 's#^To .*github\.com[:/]\([^/][^/]*/[^/ ]*\)$#\1#p' | sed 's#\.git$##' | head -n 1)
        PUSH_LINE=$(printf '%s\n' "$RESPONSE_TEXT" | grep -E '^ *[+* ]? *([0-9a-f]{7,}(\.\.\.?)[0-9a-f]{7,}|\[new branch\]) +[^ ]+ -> [^ ]+' | head -n 1 || true)
        PUSH_BRANCH=$(printf '%s\n' "$PUSH_LINE" | sed -E 's#.* -> ([^ ]+).*#\1#')
        PUSH_HEAD=$(printf '%s\n' "$PUSH_LINE" | sed -nE 's#^ *[+ ]? *[0-9a-f]{7,}\.\.\.?([0-9a-f]{7,}).*#\1#p')
        if [ -n "$PUSH_REPO" ] && [ -n "$PUSH_BRANCH" ]; then
          case "$PUSH_BRANCH" in
            refs/tags/* | v[0-9]*) ;;
            *)
              record '.pushes = ((.pushes // {}) + {($repo + ":" + $branch): {repo: $repo, branch: $branch,
                        head: (if $head == "" then null else $head end), pushed_at: $now, seq: .seq}})' \
                --arg repo "$PUSH_REPO" --arg branch "$PUSH_BRANCH" --arg head "$PUSH_HEAD"
              PUSH_MSG="Pushed ${PUSH_HEAD:-the new head} to $PUSH_REPO:$PUSH_BRANCH. If that branch backs an open PR you own, re-run /explain-diff-html for it now so the PR's explanation comment explains this head (upsert_pr_body.py refuses a stale head). Skip only a push that changes nothing a reader would notice, and say so in your report."
              ;;
          esac
        fi
        ;;
    esac
    ;;
esac

# PR-creating commands: gh pr create, or a POST to the bare /pulls route
# (`/pulls/<n>/…` is a comment or review on an existing PR, not a creation).
IS_PR_CREATE=false
case "$COMMAND" in
  *"gh pr create"*) IS_PR_CREATE=true ;;
esac
if grep -qE '(POST|post).*(/repos/|api\.github).*/pulls([^/[:alnum:]]|$)' <<< "$COMMAND" \
  || grep -qE '(/repos/|api\.github).*/pulls([^/[:alnum:]]|$).*(POST|post)' <<< "$COMMAND"; then
  IS_PR_CREATE=true
fi

if [ "$IS_PR_CREATE" = "true" ]; then
  # Extract PR URL: https://github.com/<owner>/<repo>/pull/<number>
  PR_URL=$(grep -oE 'https://github\.com/[^/"]+/[^/"]+/pull/[0-9]+' <<< "$RESPONSE" | head -n 1 || true)
  if [ -z "$PR_URL" ]; then
    PR_URL=$(echo "$RESPONSE" | jq -r '.html_url // empty' 2>/dev/null | grep -oE 'https://github\.com/[^/]+/[^/]+/pull/[0-9]+' | head -n 1 || true)
  fi
  if [ -n "$PR_URL" ]; then
    REPO=$(printf '%s' "$PR_URL" | sed -E 's#^https://github\.com/([^/]+/[^/]+)/pull/.*#\1#')
    PR_NUM=$(printf '%s' "$PR_URL" | sed -E 's#.*/pull/([0-9]+)$#\1#')
    if [ -n "$REPO" ] && [ -n "$PR_NUM" ]; then
      # The PR's branch, when the command names it (`--head [owner:]branch`,
      # `-f head=…`, `"head": "…"`). Unknown → null: any push to the repo counts
      # until an explanation binds the PR to the branch it was written from.
      BRANCH=""
      re_head='(^|[[:space:]])(--head|-H)[[:space:]=]+["'"'"']?([^"'"'"'[:space:];&|)]+)'
      re_field='(^|[[:space:]])(-f|-F|--field|--raw-field)[[:space:]=]+["'"'"']?head=([^"'"'"'[:space:];&|)]+)'
      re_json='"head"[[:space:]]*:[[:space:]]*"([^"]+)"'
      if [[ $COMMAND == *"gh pr create"* && $COMMAND =~ $re_head ]]; then
        BRANCH="${BASH_REMATCH[3]}"
      elif [[ $COMMAND =~ $re_field ]]; then
        BRANCH="${BASH_REMATCH[3]}"
      elif [[ $COMMAND =~ $re_json ]]; then
        BRANCH="${BASH_REMATCH[1]}"
      fi
      BRANCH=$(literal "${BRANCH#*:}")
      record '.seq as $s
        | .prs = ((.prs // {}) | .[$key] = ((.[$key] // {}) + {repo: $repo, number: ($num | tonumber),
            branch: (if $branch == "" then (.[$key].branch // null) else $branch end),
            created_at: $now, created_seq: $s}))' \
        --arg key "$REPO#$PR_NUM" --arg repo "$REPO" --arg num "$PR_NUM" --arg branch "$BRANCH"
      # Output instruction for the agent: (1) claim the PR for webhook routing,
      # (2) produce the HTML explanation that accompanies every PR we open
      # (container/skills/explain-diff-html — in base-common, so every project
      # spine has it). The hookSpecificOutput.additionalContext is injected into
      # the agent's next turn.
      CREATE_MSG="PR created: $REPO#$PR_NUM. IMPORTANT: Call report_pr_created(repo=\"$REPO\", pr_number=$PR_NUM) now so webhook events for this PR route to your session. Then run /explain-diff-html for $REPO#$PR_NUM: write the self-contained HTML under /workspace/agent/reports/pr-explanations/, deliver it with send_file to the thread that asked for this PR, make the same content the PR's explanation comment with its upsert_pr_body.py (one comment directly under the description, GitHub-safe Markdown, rewritten for the new head on every later push), keep the PR description itself concise (what changed, why, how tested, issue links: squash merges copy it into git log), and list the file path in the review request or report that follows. Never post the file path or internal URLs to GitHub."
    fi
  fi
fi

# An explanation comment written by upsert_pr_body.py: the receipt that clears the
# refresh owed by the create / push above. Only a real write counts — its JSON
# result line says "updated": true; --dry-run and --quiz-positions write nothing.
case "$COMMAND" in
  *upsert_pr_body.py*)
    case "$COMMAND" in
      *--dry-run* | *--quiz-positions*) ;;
      *)
        RESULT=$(printf '%s\n' "$RESPONSE_TEXT" | jq -Rc 'fromjson? | select(type == "object" and .updated == true)' 2>/dev/null | tail -n 1 || true)
        if [ -n "$RESULT" ]; then
          U_HEAD=$(jq -r '.head // ""' <<< "$RESULT" 2>/dev/null || true)
          U_REPO=$(jq -r '.repo // ""' <<< "$RESULT" 2>/dev/null || true)
          U_PR=$(jq -r '.pr // "" | tostring' <<< "$RESULT" 2>/dev/null || true)
          # Older script versions print no repo/pr: fall back to literal flags.
          re_repo='--repo[[:space:]=]+["'"'"']?([^"'"'"'[:space:];&|)]+)'
          re_pr='--pr[[:space:]=]+["'"'"']?([0-9]+)'
          if [ -z "$U_REPO" ] && [[ $COMMAND =~ $re_repo ]]; then U_REPO=$(literal "${BASH_REMATCH[1]}"); fi
          if [ -z "$U_PR" ] && [[ $COMMAND =~ $re_pr ]]; then U_PR="${BASH_REMATCH[1]}"; fi
          case "$U_PR" in '' | *[!0-9]*) U_PR="" ;; esac
          if [ -n "$U_REPO" ] && [ -n "$U_PR" ] && [ -n "$U_HEAD" ]; then
            # Bind a branch-less PR to the branch whose last push is the head
            # just explained, so later pushes to other branches stop counting.
            record 'def rname: ascii_downcase | split("/") | last;
              .seq as $s
              | ([ (.pushes // {})[] | select(type == "object")
                   | select(((.repo // "") | rname) == ($repo | rname))
                   | (.head // "") as $ph
                   | select($ph != "" and (($h | startswith($ph)) or ($ph | startswith($h)))) ]
                 | max_by(.seq // 0)) as $bound
              | .prs = ((.prs // {}) | .[$key] = (
                  ({repo: $repo, number: ($num | tonumber), branch: null, created_at: null} + (.[$key] // {}))
                  + {explained_head: $h, explained_at: $now, explained_seq: $s}
                  | if .branch == null and $bound != null then .branch = $bound.branch else . end))' \
              --arg key "$U_REPO#$U_PR" --arg repo "$U_REPO" --arg num "$U_PR" --arg h "$U_HEAD"
            EXPLAINED=1
          fi
        fi
        ;;
    esac
    ;;
esac

# The explanation comment was just rewritten in this same command; the push reminder is moot.
[ -n "$EXPLAINED" ] && PUSH_MSG=""

CTX="$CREATE_MSG"
if [ -n "$PUSH_MSG" ]; then
  CTX="${CTX:+$CTX

}$PUSH_MSG"
fi
[ -z "$CTX" ] && exit 0

jq -nc --arg ctx "$CTX" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'

exit 0
