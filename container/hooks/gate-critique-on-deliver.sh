#!/usr/bin/env bash
# PreToolUse hook (matcher: mcp__nanoclaw__send_message|Bash):
# refuse delivery / handoff / PR-create operations until at least one
# /codex-critique round has been recorded for this session.
#
# Symmetric opt-in (Model A): only fires for coworkers whose overlays
# include `critique-gate`. The composer materializes the marker file at
# /workspace/agent/.overlay-critique-gate; this hook checks for it first
# and exits 0 (no-op) when absent. Coworkers without the overlay can
# still emit [Fix Report] etc. without enforcement — opt-in by design.
#
# Delivery markers (text-prefix on send_message):
#   [Fix Report] [Resolution] [Triage Resolution] [Review Verdict] [handoff]
# PR commands (Bash):
#   gh pr create
#   gh api .../pulls
#   direct REST calls carrying api.github.com/.../pulls (curl, wget, python…)
#   GraphQL createPullRequest mutations
#
# Force-push gates intentionally NOT wired in v1 — too noisy for legitimate
# rebases of feature branches; revisit if abuse pattern emerges.
#
# Three further checks share this hook (all no-ops unless the gate is active):
#   - Long public comments (Bash: gh issue/pr comment, gh pr review, comment /
#     review API calls) must be posted from a file an OUTPUT_REVIEW attested
#     and approved. Denied comments do NOT count toward the denial cap.
#   - [Fix Review Request] / [Fix Report] are refused while a PR this session
#     created or pushed to still has a description explaining an older head
#     (lib/explain-diff-owed.sh). Not counted toward the escalation cap.
#   - A [Fix Review Request] must name its maintainer direction: a
#     `Maintainer direction:` line linking the maintainer's GitHub comments or
#     saying `none — <reason>`, plus a `Fixer self-check:` with R1, R2… when it
#     links comments. Format only. Not counted toward the escalation cap.
#
# Stdin: JSON with tool_name, tool_input. Exit 0 = allow, exit 2 = deny.
set -euo pipefail

# Opt-in gate — overlay-marker check (Model A symmetric opt-in).
# Path is overridable for testing; container default is /workspace/agent/.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
# Activation precedence: the host-injected CRITIQUE_GATE_ACTIVE env var is
# authoritative when set (the agent can't `rm .overlay-critique-gate` to
# escape it — a child process can't mutate the harness's inherited env). The
# file check is the fallback for local mode / tests where env isn't injected.
if [ -n "${CRITIQUE_GATE_ACTIVE:-}" ]; then
  [ "$CRITIQUE_GATE_ACTIVE" = "1" ] || exit 0
else
  [ -f "$OVERLAY_DIR/.overlay-critique-gate" ] || exit 0
fi

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // .tool_input.command // ""')

# Delivery vocabulary: built-in defaults, extendable (ADDITIVE only — the
# defaults can never be configured away) via .critique-delivery-markers,
# materialized by the composer from the coworker-type chain's
# delivery_markers / pr_command_patterns declarations. Marker labels are
# re-validated to a regex-metachar-free charset before splicing into the ERE.
# Built-in floor = general chain-protocol primitives only. Role-specific
# terminal names (Fix Report / Triage Resolution / Review Verdict / Triage
# handoff) come from each role's delivery_markers YAML via .critique-delivery-markers.
MSG_MARKERS='Resolution|handoff'
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
MARKERS_FILE="$OVERLAY_DIR/.critique-delivery-markers"
if [ -f "$MARKERS_FILE" ]; then
  EXTRA_MSG=$(jq -r '(.message_markers // []) | map(select(type == "string" and test("^[A-Za-z0-9][A-Za-z0-9 _-]*$"))) | join("|")' "$MARKERS_FILE" 2>/dev/null || true)
  [ -n "$EXTRA_MSG" ] && MSG_MARKERS="$MSG_MARKERS|$EXTRA_MSG"
  EXTRA_BASH=$(jq -r '(.bash_patterns // []) | map(select(type == "string" and length > 0)) | join("|")' "$MARKERS_FILE" 2>/dev/null || true)
  [ -n "$EXTRA_BASH" ] && BASH_PATTERNS="$BASH_PATTERNS|$EXTRA_BASH"
fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

# shellcheck source=lib/explain-diff-owed.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/explain-diff-owed.sh"

# ── Long public comments need a reviewed body file ──────────────────────────
# A fixer posted a 2,214-char restatement of a maintainer's design 8 s after
# being asked, before the fidelity check that found ~11 misses in it: comment
# commands never matched BASH_PATTERNS. Design statements run 2–14k chars,
# status notes 0.4–0.9k, so the line sits at CRITIQUE_COMMENT_MIN_CHARS
# (default 1000). At or above it the body must be a file whose sha256 an
# OUTPUT_REVIEW attested, with that stage's last verdict approve. The size is
# the larger of the body file and the whole command: a command that writes the
# body file and posts it in one go carries the text itself, and an existing
# (reviewed) file of the same name is not what gets posted.
# CRITIQUE_COMMENT_GATE=0 disables. These denials are NOT counted toward the
# delivery soft-cap — no state is written here.

# Path the comment body is read from, as written in the command; "" when the
# body is inline (--body, -b, -f body=) or on stdin (-, heredoc).
comment_body_ref() {
  local c="$1" q="[\"']?" p="([^\"'[:space:];&|)]+)" re
  re="--body-file[[:space:]=]+${q}${p}"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[1]}"; return 0; }
  re="(-F|--field)[[:space:]=]+${q}body=@${p}"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[2]}"; return 0; }
  re="(^|[[:space:]])-F[[:space:]]+${q}([^\"'[:space:];&|)=]+)${q}([[:space:];&|)]|$)"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[2]}"; return 0; }
  re="--input[[:space:]=]+${q}${p}"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[1]}"; return 0; }
  re="(-d|--data|--data-binary)[[:space:]=]*${q}@${p}"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[2]}"; return 0; }
  re="[\$][(](cat[[:space:]]+|<[[:space:]]*)${q}${p}"
  [[ $c =~ $re ]] && { printf '%s' "${BASH_REMATCH[2]}"; return 0; }
  return 0
}

# Absolute path of an existing body file, or "". Relative paths resolve against
# a leading `cd <abs>` in the command, then the hook's cwd.
resolve_body_path() {
  local ref="$1" base
  # shellcheck disable=SC2088  # matching a literal "~/" the shell left unexpanded
  case "$ref" in *'$'* | *'`'*) return 0 ;; "~/"*) ref="$HOME/${ref#\~/}" ;; esac
  if [ "${ref#/}" != "$ref" ]; then
    [ -f "$ref" ] && printf '%s' "$ref"
    return 0
  fi
  for base in "$CMD_CD" "$HOOK_CWD"; do
    case "$base" in /*) [ -f "$base/$ref" ] && { printf '%s' "$base/$ref"; return 0; } ;; esac
  done
  return 0
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null | awk '{print $1}'
  else
    shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
  fi
}

COMMENT_WHAT=""
if [ "$TOOL" = "Bash" ] && [ "${CRITIQUE_COMMENT_GATE:-1}" != "0" ]; then
  if grep -qE '(^|[^[:alnum:]_./-])gh[[:space:]]+(issue|pr)[[:space:]]+comment([[:space:]]|$)' <<< "$TEXT"; then
    COMMENT_WHAT="issue/PR comment"
  elif grep -qE '(^|[^[:alnum:]_./-])gh[[:space:]]+pr[[:space:]]+review([[:space:]]|$)' <<< "$TEXT"; then
    COMMENT_WHAT="PR review"
  elif grep -qE '(issues|pulls)/([0-9]+/(comments|reviews)|comments/[0-9]+)' <<< "$TEXT" \
    && grep -qE '(^|[^[:alnum:]_./-])(gh[[:space:]]+api|curl)([[:space:]]|$)' <<< "$TEXT" \
    && grep -qE '(^|[[:space:]])((-X|--method|--request)[[:space:]=]*["'"'"']?(POST|PATCH|PUT|post|patch|put)|(-f|-F|--field|--raw-field|--input|-d|--data|--data-binary|--data-raw|--json)([[:space:]=]|$))' <<< "$TEXT"; then
    COMMENT_WHAT="comment/review API call"
  elif grep -qE '(^|[^[:alnum:]_./-])gh[[:space:]]+api[[:space:]]+graphql' <<< "$TEXT" \
    && grep -qE '(addComment|addPullRequestReview|updateIssueComment)' <<< "$TEXT"; then
    COMMENT_WHAT="comment/review GraphQL mutation"
  fi
fi

if [ -n "$COMMENT_WHAT" ]; then
  COMMENT_MIN="${CRITIQUE_COMMENT_MIN_CHARS:-1000}"
  case "$COMMENT_MIN" in '' | *[!0-9]*) COMMENT_MIN=1000 ;; esac
  CMD_BYTES=$(printf '%s' "$TEXT" | wc -c | tr -d '[:space:]')
  HOOK_CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || true)
  CMD_CD=""
  re_cd="(^|[;&|(][[:space:]]*)cd[[:space:]]+[\"']?([^\"'[:space:];&|)]+)"
  [[ $TEXT =~ $re_cd ]] && CMD_CD="${BASH_REMATCH[2]}"
  BODY_REF=$(comment_body_ref "$TEXT")
  case "$BODY_REF" in - | /dev/stdin) BODY_REF="" ;; esac
  BODY_PATH=""
  BODY_BYTES=0
  COMMENT_DENY=""
  if [ -n "$BODY_REF" ]; then
    BODY_PATH=$(resolve_body_path "$BODY_REF")
    if [ -n "$BODY_PATH" ]; then
      BODY_BYTES=$(wc -c < "$BODY_PATH" | tr -d '[:space:]')
    else
      case "$BODY_REF" in
        # An absolute literal path that does not exist yet is written by this
        # same command, so its text is in the command: sized as inline below.
        /*) case "$BODY_REF" in *'$'* | *'`'*) ;; *) BODY_REF="" ;; esac ;;
      esac
      [ -n "$BODY_REF" ] && COMMENT_DENY="its body file \"$BODY_REF\" cannot be resolved (not a literal path, or relative to a directory this hook cannot see) — use an absolute path to a file written in an earlier step"
    fi
  fi
  SIZE=$CMD_BYTES
  [ "$BODY_BYTES" -gt "$SIZE" ] && SIZE=$BODY_BYTES
  if [ -z "$COMMENT_DENY" ] && [ "$SIZE" -ge "$COMMENT_MIN" ]; then
    if [ -z "$BODY_PATH" ]; then
      COMMENT_DENY="it carries ~$SIZE bytes of body text inline (--body / -f body= / heredoc / a file this same command writes), not a reviewed file"
    elif [ "$CMD_BYTES" -ge "$COMMENT_MIN" ]; then
      COMMENT_DENY="the command itself is $CMD_BYTES bytes, so it carries or rewrites body text beyond the file $BODY_PATH"
    else
      BODY_SHA=$(sha256_of "$BODY_PATH")
      ATTESTED=$(jq -r --arg h "$BODY_SHA" \
        '[((.critique_attested // {}).OUTPUT_REVIEW // {})[] | strings | ascii_downcase] | any(. == $h)' \
        "$STATE" 2>/dev/null || echo false)
      OUT_VERDICT=$(jq -r '(.critique_verdicts // {}).OUTPUT_REVIEW // ""' "$STATE" 2>/dev/null || true)
      if [ -z "$BODY_SHA" ] || [ "$ATTESTED" != "true" ]; then
        COMMENT_DENY="$BODY_PATH (sha256 ${BODY_SHA:0:12}) is not among the files an OUTPUT_REVIEW attested"
      elif [ "$OUT_VERDICT" != "approve" ]; then
        COMMENT_DENY="the last OUTPUT_REVIEW verdict is \"${OUT_VERDICT:-none}\", not \"approve\""
      fi
    fi
  fi
  if [ -n "$COMMENT_DENY" ]; then
    cat >&2 << EOF
PUBLIC COMMENT REVIEW REQUIRED before this $COMMENT_WHAT: $COMMENT_DENY.

Public comments of $COMMENT_MIN+ characters are posted only from a file an
OUTPUT_REVIEW approved:
  1. Write the body to a file in its own step
     (e.g. /workspace/agent/reports/comments/<n>-<slug>.md).
  2. Run /codex-critique with STAGE: OUTPUT_REVIEW and list that file under
     ARTIFACTS — the reviewer attests its sha256 under "### Attested".
  3. On approve, post the file unchanged with a short command:
     gh issue comment <n> --body-file <file>   (gh api: -F body=@<file>)

Status notes under $COMMENT_MIN characters need no review. This denial does not
count toward the delivery gate's denial cap.
EOF
    exit 2
  fi
fi

HIT=""
EXPLAIN_HIT=""
RR_HIT=""
case "$TOOL" in
  mcp__nanoclaw__send_message)
    # Anchored to line start (the chain protocol emits markers as message /
    # line prefixes). Unanchored matching burned a denial — and one of the
    # session's 3 soft-cap strikes — every time an agent merely MENTIONED a
    # marker mid-sentence in a status update.
    # Herestring, not `echo | grep -q`: under pipefail grep's early exit can
    # SIGPIPE the echo and abort the hook — a rare flake that here would mean
    # a silent gate bypass.
    if grep -qE "^[[:space:]]*\[($MSG_MARKERS)\]" <<< "$TEXT"; then
      HIT="delivery/handoff message"
    fi
    # A fix report / review request presents the PR to a reviewer, who reads
    # its description first — so it waits until that describes the pushed head.
    if [ "${EXPLAIN_DIFF_GATE:-1}" != "0" ] \
      && grep -qE '^[[:space:]]*\[(Fix Review Request|Fix Report)\]' <<< "$TEXT"; then
      EXPLAIN_HIT="fix report / review request"
    fi
    # The review request itself — the message must START with the marker (a
    # status note that quotes one mid-text is not a request).
    re_rr='^[[:space:]]*\[Fix Review Request\]'
    if [ "${REVIEW_REQUEST_GATE:-1}" != "0" ] && [[ $TEXT =~ $re_rr ]]; then
      RR_HIT="review request"
    fi
    ;;
  Bash)
    # Known PR-creation shapes: the gh CLI, direct REST calls carrying the
    # /pulls route (curl/wget/python — any http client), and the GraphQL
    # mutation name. Pattern enumeration can never be complete — the durable
    # backstop is credential-layer enforcement at the OneCLI proxy — but
    # these cover every egress shape observed in production.
    if grep -qE "($BASH_PATTERNS)" <<< "$TEXT"; then
      HIT="PR creation"
    fi
    ;;
esac

[ -z "$HIT" ] && [ -z "$EXPLAIN_HIT" ] && [ -z "$RR_HIT" ] && exit 0

# ABSTAIN fast-path (PR-approver): an [Approval Decision] whose state is
# ABSTAIN_POLICY / ABSTAIN_INFRA makes NO positive claim about the code — it
# routes the PR to a human ("must look" / pipeline couldn't decide). Those
# states are not critique-gated: only WOULD_APPROVE and BLOCK (the states that
# assert something) require DECISION_REVIEW + OUTPUT_REVIEW. Relaxing here is
# safe because an abstain never auto-approves; the worst an agent could do by
# mislabelling a WOULD_APPROVE as an abstain is decline to approve. Matched on
# the decision token in the delivered message, anchored so a mid-sentence
# mention of the word doesn't trip it. CRITIQUE_ABSTAIN_FASTPATH=0 disables.
if [ "$TOOL" = "mcp__nanoclaw__send_message" ] && [ -z "$EXPLAIN_HIT" ] && [ -z "$RR_HIT" ] \
  && [ "${CRITIQUE_ABSTAIN_FASTPATH:-1}" != "0" ]; then
  if grep -qE '\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b' <<< "$TEXT" \
     && ! grep -qE '\b(WOULD_APPROVE|BLOCK)\b' <<< "$TEXT"; then
    exit 0
  fi
fi

# Required-stages enforcement (per-overlay opt-in via .critique-required-stages,
# materialized by the composer from the matched overlays' frontmatter).
# Without that file, fall back to the historical "any 1 critique round" check
# so coworkers using the bare critique-gate overlay keep working unchanged.
#
# Source precedence, mirroring activation: the host-injected
# CRITIQUE_REQUIRED_STAGES env var wins when set (agent can't rewrite it to
# weaken the gate); the file is the fallback. We materialize the env JSON to a
# temp file so the existing jq-on-file logic below is unchanged.
REQUIRED_FILE="$OVERLAY_DIR/.critique-required-stages"
if [ -n "${CRITIQUE_REQUIRED_STAGES:-}" ]; then
  REQUIRED_FILE=$(mktemp 2>/dev/null || echo "/tmp/.crit-req-$$")
  printf '%s' "$CRITIQUE_REQUIRED_STAGES" > "$REQUIRED_FILE"
  trap 'rm -f "$REQUIRED_FILE"' EXIT
fi
DENIAL_REASON=""

if [ -z "$HIT" ]; then
  : # a [Fix Review Request] that is not a declared delivery marker: refresh check only
elif [ -f "$REQUIRED_FILE" ] && jq -e 'length > 0' "$REQUIRED_FILE" >/dev/null 2>&1; then
  DONE=$(jq -c '.critique_stages // {}' "$STATE" 2>/dev/null || echo '{}')
  VERDICTS=$(jq -c '.critique_verdicts // {}' "$STATE" 2>/dev/null || echo '{}')
  MISSING=$(jq -r --argjson done "$DONE" '
    map(select(($done[.] // 0) < 1)) | join(", ")
  ' "$REQUIRED_FILE" 2>/dev/null || echo "")
  if [ -n "$MISSING" ]; then
    DENIAL_REASON="missing critique stages: $MISSING"
  fi
  # PLAN_REVIEW verdict gate (fixer path): a must-fix plan review — e.g. "a
  # maintainer requirement was dropped" — used to block nothing, because only
  # the stage's count was checked. Same semantics as the OUTPUT_REVIEW gate
  # below, including CRITIQUE_VERDICT_STRICT fail-closed on a missing verdict.
  if [ -z "$DENIAL_REASON" ] && jq -e 'index("PLAN_REVIEW")' "$REQUIRED_FILE" >/dev/null 2>&1; then
    PLAN_VERDICT=$(jq -r '.PLAN_REVIEW // empty' <<< "$VERDICTS" 2>/dev/null || true)
    if [ -n "$PLAN_VERDICT" ] && [ "$PLAN_VERDICT" != "approve" ]; then
      DENIAL_REASON="PLAN_REVIEW last verdict is \"$PLAN_VERDICT\" (must be \"approve\"). Re-run /codex-critique with STAGE: PLAN_REVIEW after fixing the plan"
    elif [ -z "$PLAN_VERDICT" ] && [ "${CRITIQUE_VERDICT_STRICT:-1}" != "0" ]; then
      DENIAL_REASON="PLAN_REVIEW ran but no verdict was recorded (missing or unparseable). Re-run /codex-critique with STAGE: PLAN_REVIEW and make sure codex returns a '### Verdict' section containing approve or must-fix"
    fi
  fi
  # OUTPUT_REVIEW verdict gate: count>=1 is not enough — last verdict must be
  # "approve". This prevents delivering with an un-reverified must-fix output.
  # Fails CLOSED when OUTPUT_REVIEW is required but no verdict was recorded:
  # a missing verdict means the recorder couldn't parse one, and 33% of June
  # stage-rounds had no recorded verdict — passing those count-only is exactly
  # the leak the verdict gate exists to close. CRITIQUE_VERDICT_STRICT=0
  # restores the legacy count-only fallthrough.
  if [ -z "$DENIAL_REASON" ] && jq -e 'index("OUTPUT_REVIEW")' "$REQUIRED_FILE" >/dev/null 2>&1; then
    OUTPUT_VERDICT=$(jq -r '.OUTPUT_REVIEW // empty' <<< "$VERDICTS" 2>/dev/null || true)
    if [ -n "$OUTPUT_VERDICT" ] && [ "$OUTPUT_VERDICT" != "approve" ]; then
      DENIAL_REASON="OUTPUT_REVIEW last verdict is \"$OUTPUT_VERDICT\" (must be \"approve\"). Re-run /codex-critique with STAGE: OUTPUT_REVIEW after fixing the issues"
    elif [ -z "$OUTPUT_VERDICT" ] && [ "${CRITIQUE_VERDICT_STRICT:-1}" != "0" ]; then
      DENIAL_REASON="OUTPUT_REVIEW ran but no verdict was recorded (missing or unparseable). Re-run /codex-critique with STAGE: OUTPUT_REVIEW and make sure codex returns a '### Verdict' section containing approve or must-fix"
    fi
  fi
  # Freshness: the OUTPUT_REVIEW approve must postdate the last mutation.
  # track-edits.sh bumps edits_since_critique on every substantive edit and
  # track-critique.sh zeroes it on every recorded round — so a nonzero count
  # here means the approve covers code that has since changed
  # (approve-then-edit-then-ship). CRITIQUE_FRESHNESS=0 disables.
  if [ -z "$DENIAL_REASON" ] && [ "${CRITIQUE_FRESHNESS:-1}" != "0" ] \
    && jq -e 'index("OUTPUT_REVIEW")' "$REQUIRED_FILE" >/dev/null 2>&1; then
    EDITS=$(jq -r '.edits_since_critique // 0' "$STATE" 2>/dev/null || echo 0)
    case "$EDITS" in *[!0-9]*|'') EDITS=0 ;; esac
    if [ "$EDITS" -gt 0 ]; then
      DENIAL_REASON="$EDITS edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers the current state. Re-run /codex-critique with STAGE: OUTPUT_REVIEW"
    fi
  fi
  # Attested-hash binding: the reviewer lists sha256 hashes of the artifacts
  # it actually read ("### Attested" section, recorded by track-critique.sh).
  # Re-hash them at delivery time — an approve whose reviewed artifacts have
  # since changed does not ship. Precise complement to the blunt freshness
  # counter: it also catches edit → other-stage critique (counter reset) →
  # deliver-with-stale-approve. Opportunistic: no attestation → no check.
  # CRITIQUE_ATTEST=0 disables; CRITIQUE_ATTEST_ROOT bounds which paths are
  # verified (default /workspace).
  if [ -z "$DENIAL_REASON" ] && [ "${CRITIQUE_ATTEST:-1}" != "0" ] \
    && jq -e 'index("OUTPUT_REVIEW")' "$REQUIRED_FILE" >/dev/null 2>&1; then
    ATT=$(jq -c '(.critique_attested // {}).OUTPUT_REVIEW // {}' "$STATE" 2>/dev/null || echo '{}')
    if [ -n "$ATT" ] && [ "$ATT" != "{}" ] && [ "$ATT" != "null" ]; then
      ATTEST_ROOT="${CRITIQUE_ATTEST_ROOT:-/workspace}"
      CHANGED=""
      while IFS=$'\t' read -r p h; do
        [ -z "$p" ] && continue
        case "$p" in "$ATTEST_ROOT"/*) ;; *) continue ;; esac
        if [ -f "$p" ]; then
          CUR=$(sha256sum "$p" 2>/dev/null | awk '{print $1}' || true)
          [ "$CUR" = "$h" ] || CHANGED="$CHANGED $p"
        else
          CHANGED="$CHANGED $p(missing)"
        fi
      done <<EOF_ATT
$(jq -r 'to_entries[:20][] | "\(.key)\t\(.value)"' <<< "$ATT" 2>/dev/null || true)
EOF_ATT
      if [ -n "$CHANGED" ]; then
        DENIAL_REASON="reviewed artifacts changed since the OUTPUT_REVIEW approve:$CHANGED. Re-run /codex-critique with STAGE: OUTPUT_REVIEW"
      fi
    fi
  fi
else
  ROUNDS=$(jq -r '.critique_rounds // 0' "$STATE" 2>/dev/null || echo 0)
  if [ "$ROUNDS" -lt 1 ]; then
    DENIAL_REASON="no critique rounds recorded (critique_rounds=$ROUNDS)"
  fi
fi

# PR description refresh: a fix report / review request waits until every PR
# this session created or pushed to has a description explaining its pushed
# head. Checked after the critique so a delivery short on both hears about the
# critique first. Like the comment rule it leaves the denial counter alone: the
# remedy is an upsert, not a critique round, and the escalation path (retracted
# only by a new critique round) would card a human for nothing.
GATE_TITLE="CRITIQUE REQUIRED"
REMEDY="Run /codex-critique for the stage named above"
if [ -z "$DENIAL_REASON" ] && [ -n "$EXPLAIN_HIT" ]; then
  OWED=$(explain_diff_owed_lines)
  if [ -n "$OWED" ]; then
    OWED_LIST=$(jq -rn --arg o "$OWED" '$o | split("\n") | map(select(length > 0)) | join("; and ")')
    cat >&2 << EOF
PR DESCRIPTION REFRESH REQUIRED before this $EXPLAIN_HIT: $OWED_LIST.

Run /explain-diff-html for the PR's current head (upsert_pr_body.py), then
resend. If the upsert itself fails (e.g. a GitHub error), tell your parent in a
plain message instead of resending the marker. This denial does not count
toward the critique escalation. EXPLAIN_DIFF_GATE=0 (host env) disables it.
EOF
    exit 2
  fi
fi

# ── [Fix Review Request] names its maintainer direction ─────────────────────
# The fixer's codex rounds must carry the maintainer's words (REQUIREMENTS:,
# track-critique.sh), but the review request the reviewer and humans read did
# not have to. On #13213 the reviewer worked from a relay of a relay. So the
# request must name its source: a `Maintainer direction:` line linking the
# maintainer's GitHub comments, or `none — <reason>`; and when it links
# comments, a `Fixer self-check:` scoring them as R1, R2… Format only: whether
# the cited direction is complete or quoted accurately is the reviewer's check
# (spec-fidelity — it builds its own list from the issue and PR). Like the
# comment and refresh rules it leaves the denial counter alone: the remedy is
# an edit to the message, and the escalation path would card a human for
# nothing. REVIEW_REQUEST_GATE=0 (host env) disables.

# Prints what is missing from a review request, or nothing when it is complete.
# Labels tolerate list bullets and markdown bold; a label's value runs on until
# the next `Label:` line (at most 15 lines), so a list of links under the label
# counts. `https:` is not a label: a label's colon is followed by a space or EOL.
review_request_problem() {
  awk '
    function norm(s) { sub(/^[ \t]*([-*+][ \t]+)?/, "", s); gsub(/\*\*|__/, "", s); return s }
    function islabel(s) { return (tolower(s) ~ /^[a-z][a-z0-9 \/()_-]*:([ \t]|$)/) }
    { line = norm($0); low = tolower(line) }
    mode != "" && (islabel(line) || n >= 15) { mode = "" }
    mode == "dir" { dir = dir " " line; n++; next }
    mode == "sc" { sc = sc " " line; n++; next }
    !hasdir && low ~ /^maintainer direction[ \t]*:/ {
      hasdir = 1; v = line; sub(/^[^:]*:[ \t]*/, "", v); dir = v; mode = "dir"; n = 0; next
    }
    !hassc && low ~ /^fixer self-check[ \t]*:/ {
      hassc = 1; v = line; sub(/^[^:]*:[ \t]*/, "", v); sc = v; mode = "sc"; n = 0; next
    }
    END {
      if (!hasdir) { print "it has no `Maintainer direction:` line"; exit }
      if (dir !~ /github\.com\/[^ \t)]*(issuecomment-[0-9]+|pullrequestreview-[0-9]+|discussion_r[0-9]+|#issue-[0-9]+)/) {
        d = tolower(dir); gsub(/`/, "", d); sub(/^[ \t]+/, "", d)
        if (d ~ /^none[ \t]*(—|–|-|:|\()[ \t]*[^ \t)]/) exit
        if (d ~ /^none[ \t.]*$/) { print "its `Maintainer direction:` says a bare \"none\" with no reason"; exit }
        print "its `Maintainer direction:` neither links a maintainer comment on GitHub nor says none with a reason"; exit
      }
      if (!hassc) { print "it cites maintainer comments but has no `Fixer self-check:` line"; exit }
      if (sc !~ /(^|[^A-Za-z0-9])[Rr][0-9]+([^0-9]|$)/) { print "its `Fixer self-check:` has no R1, R2… items"; exit }
    }
  ' <<< "$1"
}

if [ -z "$DENIAL_REASON" ] && [ -n "$RR_HIT" ]; then
  RR_PROBLEM=$(review_request_problem "$TEXT")
  if [ -n "$RR_PROBLEM" ]; then
    echo "REVIEW REQUEST INCOMPLETE: $RR_PROBLEM. Expected \`Maintainer direction: https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<id>\` (one link per maintainer comment) or \`Maintainer direction: none — <why no maintainer direction applies>\`, and with links \`Fixer self-check: R1 met · R2 partial (why)\` — fix the message and resend; this does not count toward the critique escalation (REVIEW_REQUEST_GATE=0 disables)." >&2
    exit 2
  fi
fi

if [ -n "$DENIAL_REASON" ]; then
  # Denial cap → escalation. After 3 denies in a single session the gate writes
  # an escalation request file and KEEPS DENYING. The host sweep reads that
  # file and either self-heals it (drives the agent to run the critique it
  # skipped) or, for a critique that ran and returned must-fix, asks an admin.
  #
  # The gate does NOT open on its own. There is deliberately no timeout release
  # here: the previous 30-minute fail-open meant an agent could satisfy the
  # requirement by waiting, and because container stderr dies with the
  # container (--rm) the host never learned it had happened. Enforcement is now
  # released only by an explicit, one-shot, TTL'd admin approval — or by the
  # CRITIQUE_ESCALATION=0 kill switch, which is recorded like any other release.
  DENIALS=$(jq -r '.critique_gate_denials // 0' "$STATE" 2>/dev/null || echo 0)
  ESC_FILE="${CRITIQUE_ESCALATION_FILE:-$(dirname "$STATE")/critique-escalation.json}"
  NOW_EPOCH=$(date +%s)
  NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  RELEASE_JOURNAL="${CRITIQUE_RELEASE_JOURNAL:-$(dirname "$ESC_FILE")/critique-releases.jsonl}"

  # Record an enforcement release where the HOST can see it. Everything here is
  # on the session bind-mount; container stderr is not a durable trace, because
  # containers run --rm.
  #
  # TWO SINKS, ONE ID:
  #
  #   critique-releases.jsonl   append-only, always written. The escalation
  #                             file can legitimately be GONE by the time we
  #                             reach this line — the host retires a settled
  #                             request, and it does so between our own two
  #                             writes: we mark the grant consumed in
  #                             workflow-state.json above, the sweep sees that
  #                             and retires, and only then do we stamp. This
  #                             sink cannot be retired out from under us.
  #   critique-escalation.json  merged into when it exists, because it carries
  #                             the request's own audit context.
  #
  # Both carry the same event id and the host records under it exactly once, so
  # writing both never double-counts a release.
  #
  # It deliberately does NOT create the escalation file when absent. That is
  # what this function used to do, with `requested_at: 0`, and the host then
  # read the fabrication as a brand-new escalation: it carded a human for a
  # decision nobody asked for while the real release went unrecorded and its
  # association with the original request was destroyed.
  #
  # Returns non-zero when NOTHING was recorded — an unrecordable release is an
  # invisible one, and the caller must decide rather than assume it landed.
  stamp_failed_open() {
    _why="$1"
    _gid="${2:-}"
    _eid="rel-${NOW_EPOCH}-$$-${RANDOM:-0}"
    _recorded=1

    _line=$(jq -cn --arg id "$_eid" --arg at "$NOW_ISO" --arg why "$_why" \
              --arg reason "$DENIAL_REASON" --arg hit "$HIT" --arg gid "$_gid" \
              '{event_id: $id, at: $at, why: $why, reason: $reason, hit: $hit,
                grant_id: (if $gid == "" then null else $gid end)}' 2>/dev/null) || _line=""
    if [ -n "$_line" ] && printf '%s\n' "$_line" >> "$RELEASE_JOURNAL" 2>/dev/null; then
      _recorded=0
    fi

    if [ -f "$ESC_FILE" ]; then
      if jq --arg at "$NOW_ISO" --arg why "$_why" --arg id "$_eid" \
           '. + {failed_open_at: $at, failed_open_why: $why, failed_open_event_id: $id}' \
           "$ESC_FILE" > "$ESC_FILE.tmp" 2>/dev/null && mv "$ESC_FILE.tmp" "$ESC_FILE" 2>/dev/null; then
        _recorded=0
      else
        rm -f "$ESC_FILE.tmp" 2>/dev/null || true
      fi
    fi
    return "$_recorded"
  }

  if [ "$DENIALS" -ge 3 ]; then
    if [ "${CRITIQUE_ESCALATION:-1}" = "0" ]; then
      # The kill switch is an operator's explicit standing instruction to let
      # deliveries through, so an unrecordable release does NOT convert it into
      # a refusal the way the admin-bypass path below does. It does not pass
      # quietly either.
      if ! stamp_failed_open "CRITIQUE_ESCALATION=0 kill switch"; then
        echo "[critique-gate] WARNING: this kill-switch release could NOT be recorded in $(dirname "$ESC_FILE") — the host will never learn the gate opened." >&2
      fi
      cat >&2 << EOF
[critique-gate soft-fail] Allowing $HIT despite unresolved requirement
($DENIAL_REASON). The gate denied this session 3 times already; further
denials would just thrash. If the agent is consistently bypassing critique,
the workflow / overlay setup needs review.
EOF
      exit 0
    fi
    # Admin bypass — ONE-SHOT and time-limited. It used to be a latched
    # boolean that nothing ever cleared, so a single approval stood the gate
    # open for the rest of the session's life (sessions here live for weeks).
    # Consume it on use and honour its expiry.
    BYPASS=$(jq -r '.critique_gate_bypass_approved // false' "$STATE" 2>/dev/null || echo false)
    if [ "$BYPASS" = "true" ]; then
      BYPASS_EXP=$(jq -r '.critique_gate_bypass_expires_at // 0' "$STATE" 2>/dev/null || echo 0)
      case "$BYPASS_EXP" in *[!0-9]*|'') BYPASS_EXP=0 ;; esac
      # A grant with no usable expiry is NOT an unlimited grant. Treating a
      # missing or non-numeric value as "no expiry" would let a forged flag
      # with no expiry at all defeat the TTL entirely — fail closed instead.
      if [ "$BYPASS_EXP" -le 0 ] || [ "$NOW_EPOCH" -ge "$BYPASS_EXP" ]; then
        # Expired (or unusable) grant: clear it and fall through to denial.
        jq '. + {critique_gate_bypass_approved: false, critique_gate_bypass_expired_at: '"$NOW_EPOCH"'}' \
          "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" || true
        echo "[critique-gate] Admin bypass EXPIRED or has no usable expiry — requirement still enforced." >&2
      else
        # Attribute the consumption to the grant that authorized it. The host
        # reconciler matches on this id; without it a perfectly legitimate
        # bypass looks like a consumption of a grant nobody issued.
        GRANT_ID=$(jq -r '.critique_gate_bypass_grant_id // ""' "$STATE" 2>/dev/null || echo "")
        jq --arg gid "$GRANT_ID" \
          '. + {critique_gate_bypass_approved: false,
                critique_gate_bypass_consumed_grant_id: (if $gid == "" then null else $gid end),
                critique_gate_bypass_consumed_at: '"$NOW_EPOCH"'}' \
          "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" || true
        # The one-shot property depends on that write. If it did not land the
        # grant is still `approved` and would be reusable on every subsequent
        # delivery, so refuse rather than allow — a delivery denied is
        # recoverable, a permanently reusable waiver is not.
        STILL_APPROVED=$(jq -r '.critique_gate_bypass_approved // false' "$STATE" 2>/dev/null || echo true)
        if [ "$STILL_APPROVED" = "true" ]; then
          cat >&2 << EOF
CRITIQUE REQUIRED before $HIT — the admin bypass could NOT be recorded as
consumed, so allowing it would leave a reusable waiver. Refusing instead.

Reason: $DENIAL_REASON.
EOF
          exit 2
        fi
        # Same reasoning as the consumption check above, one step further on: a
        # release nobody can see is worse than a denied delivery. The grant is
        # already spent, so the host will report it as an ORPHANED release —
        # which is the accurate description of what just happened.
        if ! stamp_failed_open "admin bypass consumed (one-shot)" "$GRANT_ID"; then
          cat >&2 << EOF
CRITIQUE REQUIRED before $HIT — the admin bypass was consumed, but the release
could NOT be recorded anywhere the host can see it, so allowing it would open
the gate with no durable trace. Refusing instead.

Reason: $DENIAL_REASON.

Ask an admin to re-approve once $(dirname "$ESC_FILE") is writable.
EOF
          exit 2
        fi
        echo "[critique-gate] Delivery allowed by admin-approved bypass, now CONSUMED (requirement still unmet: $DENIAL_REASON)." >&2
        exit 0
      fi
    fi
    # A rejection answers the request it was made about — not every future one.
    # Unscoped, this latched forever and also suppressed re-escalation, so one
    # old "no" silently decided every later delivery in the session.
    REJECTED=$(jq -r '.critique_gate_bypass_rejected // false' "$STATE" 2>/dev/null || echo false)
    REJECTED_REQ=$(jq -r '.critique_gate_bypass_rejected_request // 0' "$STATE" 2>/dev/null || echo 0)
    case "$REJECTED_REQ" in *[!0-9]*|'') REJECTED_REQ=0 ;; esac
    CUR_REQ=0
    if [ -f "$ESC_FILE" ]; then
      CUR_REQ=$(jq -r '.requested_at // 0' "$ESC_FILE" 2>/dev/null || echo 0)
      case "$CUR_REQ" in *[!0-9]*|'') CUR_REQ=0 ;; esac
    fi
    if [ "$REJECTED" = "true" ] && [ "$REJECTED_REQ" != "$CUR_REQ" ]; then
      REJECTED=false   # stale rejection from an earlier, unrelated escalation
    fi
    if [ "$REJECTED" = "true" ]; then
      cat >&2 << EOF
CRITIQUE REQUIRED before $HIT — an admin REJECTED the bypass request.

Reason: $DENIAL_REASON.

Satisfy the critique requirement (/codex-critique) or report the blocker to
your parent instead of delivering.
EOF
      exit 2
    fi
    if [ -f "$ESC_FILE" ]; then
      # An escalation is already open for this session. The gate stays shut
      # while the host works it — self-healing it (the usual case) or asking an
      # admin. Waiting does not clear it; running the critique does.
      ATTEMPTS=$(jq -r '.self_heal_attempts // 0' "$ESC_FILE" 2>/dev/null || echo 0)
      case "$ATTEMPTS" in *[!0-9]*|'') ATTEMPTS=0 ;; esac
      FORWARDED=$(jq -r '.forwarded_at // ""' "$ESC_FILE" 2>/dev/null || echo "")
      if [ -n "$FORWARDED" ]; then
        cat >&2 << EOF
CRITIQUE REQUIRED before $HIT — escalated to an admin, awaiting their decision.

Reason: $DENIAL_REASON.

The gate will NOT time out or open on its own. Satisfy the requirement with
/codex-critique — that clears it immediately and retracts the request — or
wait for the admin decision. Do not retry the delivery in a tight loop.
EOF
      else
        cat >&2 << EOF
$GATE_TITLE before $HIT — denial cap reached (self-heal attempt $ATTEMPTS).

Reason: $DENIAL_REASON.

$REMEDY, then retry. The gate will NOT
open on its own; there is no timeout. If you genuinely cannot run the
critique, say why in this session and an admin will be asked.
EOF
      fi
      exit 2
    fi
    jq -n --arg reason "$DENIAL_REASON" --arg hit "$HIT" --argjson at "$NOW_EPOCH" --argjson denials "$DENIALS" \
      '{requested_at: $at, reason: $reason, hit: $hit, denials: $denials}' > "$ESC_FILE" 2>/dev/null || true
    cat >&2 << EOF
$GATE_TITLE before $HIT — denial cap reached; escalation opened.

Reason: $DENIAL_REASON.

$REMEDY, then retry the $HIT. The gate
does not time out and will not open on its own. If you cannot run the
critique, say why in this session — after repeated attempts an admin is asked.
EOF
    exit 2
  fi
  jq '.critique_gate_denials = ((.critique_gate_denials // 0) + 1)' "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" || true
  if [ "$GATE_TITLE" != "CRITIQUE REQUIRED" ]; then
    cat >&2 << EOF
$GATE_TITLE before $HIT.

Reason: $DENIAL_REASON.

The reviewer reads the PR description first, so it must explain the head you
pushed. $REMEDY for each PR named above, then resend.
EOF
    exit 2
  fi
  cat >&2 << EOF
CRITIQUE REQUIRED before $HIT.

Reason: $DENIAL_REASON.

Invoke /codex-critique on the work you are about to deliver, then retry.
Codex will read the artifacts, score them, and either approve or return
must-fix items.

If multiple stages are required, run /codex-critique once per listed
STAGE value (the codex-critique skill defines DIAGNOSIS_REVIEW,
PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW).
EOF
  exit 2
fi

exit 0
