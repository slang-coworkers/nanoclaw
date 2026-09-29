#!/usr/bin/env bash
# PostToolUse hook (matcher: mcp__codex__codex|mcp__codex__codex-reply):
# every successful codex MCP call counts as a critique round, EXCEPT calls
# made by buddy (which we identify by signature in the prompt).
#
# Buddy's first codex call sends "You are Buddy" verbatim in its developer-
# instructions field; subsequent codex-reply calls send a "BATCH n (" header
# in the prompt. Either signature → not a critique. Anything else (including
# any other codex invocation a workflow might wire up later) → counts as a
# critique round.
#
# Stdin: JSON with tool_name, tool_input, tool_response. Exit 0 always.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$TOOL" in
  mcp__codex__codex|mcp__codex__codex-reply) ;;
  *) exit 0 ;;
esac

# Skip buddy invocations. (Bounded at 2000 chars — long enough to contain the
# canonical reviewer block checked by the instruction-pinning gate below.)
# The prompt cap must reach the STAGE / REQUIREMENTS fields behind a long
# verbatim TASK block; at 500 chars both were silently missed. `|| true`: a
# field longer than the pipe buffer makes jq die of SIGPIPE when head exits,
# which under pipefail would abort the hook.
DEV_INST=$(echo "$INPUT" | jq -r '.tool_input."developer-instructions" // .tool_input.developer_instructions // empty' 2>/dev/null | head -c 2000 || true)
PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null | head -c 16000 || true)
# Herestrings, not `echo | grep -q`: under pipefail, grep -q's early exit can
# SIGPIPE the echo (exit 141) and abort the whole hook mid-run — a rare,
# timing-dependent flake that silently dropped recordings.
if grep -q "You are Buddy" <<< "$DEV_INST" 2>/dev/null; then exit 0; fi
# Buddy's BATCH header opens its prompt; keep the signature check on the head
# so a TASK line that happens to read "BATCH 2 (" doesn't drop a real round.
if grep -qE "^BATCH [0-9]+ \(" <<< "${PROMPT:0:500}" 2>/dev/null; then exit 0; fi

# Skip error / timeout responses. Sniff only a bounded prefix here — the
# verdict parse below must see the FULL payload. (Truncating the whole
# response to 2000 bytes before parsing cut long reviews mid-JSON and
# silently dropped their verdicts: 45% of June must-fix verdicts were lost
# that way, and a lost must-fix downgrades the delivery gate to count-only.)
RESPONSE_HEAD=$(echo "$INPUT" | jq -r '.tool_response // empty' 2>/dev/null | head -c 2000 || true)
if grep -qE '"error":|"is_error":\s*true|"timed[_ ]out"|^Error\b' <<< "$RESPONSE_HEAD" 2>/dev/null; then exit 0; fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"
mkdir -p "$(dirname "$STATE")"
[ -f "$STATE" ] || echo '{}' > "$STATE"

# Parse STAGE: marker from the codex prompt — only present on direct
# `mcp__codex__codex` calls (the entry point of a critique session).
# `mcp__codex__codex-reply` continuations don't carry STAGE; they inherit the
# parent thread's stage via the critique_threads map recorded below. We mark
# a stage as completed (count>=1) on the first call carrying it; iteration
# rounds bump critique_rounds but don't double-count the stage.
#
# `|| true` is load-bearing: under `set -euo pipefail`, grep's exit-1 on
# no-match would propagate through the command substitution and abort the
# script before the jq update, leaving critique_rounds unincremented for
# codex-reply calls (which legitimately have no STAGE marker).
# grep -m1 (stop after first match) instead of `| head -1`, which could
# SIGPIPE grep under pipefail and blank the stage.
STAGE=$(grep -m1 -oE 'STAGE:[[:space:]]*[A-Z_]+' <<< "$PROMPT" 2>/dev/null | sed -E 's/^STAGE:[[:space:]]*//' || true)

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Extract verdict from codex response content ("### Verdict\napprove" or "### Verdict\nmust-fix").
# In production tool_response arrives as a JSON-encoded string
# ('{"threadId":…,"content":…}' serialized into one string); handle the
# object shape and plain text too. Parsed from the full response — never
# truncate before this parse (see RESPONSE_HEAD note above).
VERDICT=""
CONTENT=$(echo "$INPUT" | jq -r '
  .tool_response as $r
  | (if ($r | type) == "string" then ($r | (try fromjson catch {content: $r})) else ($r // {}) end)
  | if type == "object" then (.content // empty) else empty end
' 2>/dev/null || true)
if [ -n "$CONTENT" ]; then
  # Accept "### Verdict\napprove", inline "### Verdict: approve", blank lines
  # before the verdict word, and any capitalization / markdown emphasis
  # ("**Approve**", "approve."). Normalize to lowercase a-z + hyphen, then
  # validate against the verdict vocabulary — anything else records as
  # "unparseable" so the gate can fail closed on it instead of silently
  # passing count-only (~7% of June rounds had a garbled verdict line).
  RAW_VERDICT=$(awk '
    found == 1 && NF {
      if ($0 ~ /^#/) { exit }   # next section heading — no verdict word given
      print; exit
    }
    tolower($0) ~ /^###[ \t]*verdict/ {
      line = $0
      sub(/^###[ \t]*[Vv][Ee][Rr][Dd][Ii][Cc][Tt][ \t:]*/, "", line)
      if (line ~ /[A-Za-z]/) { print line; exit }
      found = 1
    }
  ' <<< "$CONTENT" 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z-' | head -c 30 || true)
  case "$RAW_VERDICT" in
    approve|approved) VERDICT="approve" ;;
    must-fix|mustfix) VERDICT="must-fix" ;;
    "") VERDICT="" ;;
    *) VERDICT="unparseable" ;;
  esac
fi

# Reviewer-attested artifact hashes: the "### Attested" section lists
# "- <sha256> <path>" lines for files the reviewer actually read. Recording
# them lets the delivery gate re-hash at send time and refuse to ship an
# approve whose reviewed artifacts have since changed — binding the verdict
# to the exact content reviewed, not just to a timestamp.
#
# PORTABILITY (load-bearing): the container's awk is mawk/busybox, which does
# NOT support {n} interval expressions — a prior version filtered hash lines
# with an awk `[a-f0-9]{64}` pattern that matched under the host's gawk (so
# tests + host runs passed) but silently matched NOTHING in-container, so no
# attestation was ever recorded despite reviewers emitting correct hashes.
# The 64-hex validation therefore lives in jq (Oniguruma — intervals reliable
# everywhere); awk only delimits the section, with no interval. jq's capture
# also naturally skips the "<sha256> <path>" instruction-echo placeholder,
# "- none", and any trailing "— comment".
ATTESTED_JSON='{}'
if [ -n "$CONTENT" ]; then
  ATTESTED_LINES=$(awk '
    in_att && /^###/ { exit }
    in_att { print }
    tolower($0) ~ /^###[ \t]*attested/ { in_att = 1 }
  ' <<< "$CONTENT" 2>/dev/null | head -40 || true)
  if [ -n "$ATTESTED_LINES" ]; then
    ATTESTED_JSON=$(jq -Rn '
      [ inputs
        | capture("-[ \\t]*(?<h>[a-fA-F0-9]{64})[ \\t]+(?<p>[^ \\t]+)")
        | { (.p): (.h | ascii_downcase) } ] | add // {}
    ' <<< "$ATTESTED_LINES" 2>/dev/null || echo '{}')
  fi
fi
[ -n "$ATTESTED_JSON" ] || ATTESTED_JSON='{}'

# Thread identity: the initial call's response carries the codex threadId;
# codex-reply calls carry it in tool_input. Recording threadId → STAGE on the
# initial call lets a reply's verdict update the SAME stage. The skill's
# prescribed re-verify flow is `codex-reply` on the saved thread — before this
# mapping those verdicts only landed in last_critique_verdict, leaving
# critique_verdicts[stage] stuck at must-fix and the delivery gate denying an
# already-approved deliverable until the soft-cap opened (June thrash).
TID=$(echo "$INPUT" | jq -r '
  (.tool_input.threadId // .tool_input.thread_id // "") as $in
  | (.tool_response as $r
     | (if ($r | type) == "string" then ($r | (try fromjson catch {})) else ($r // {}) end)
     | (if type == "object" then (.threadId // "") else "" end)) as $resp
  | (if $resp != "" then $resp else $in end)
' 2>/dev/null || true)

# Reply calls carry no STAGE:; resolve their stage from the thread map.
REPLY_STAGE=""
if [ -z "$STAGE" ] && [ -n "$TID" ] && [ -f "$STATE" ]; then
  REPLY_STAGE=$(jq -r --arg t "$TID" '(.critique_threads // {})[$t] // ""' "$STATE" 2>/dev/null || true)
fi

# Reviewer-instruction pinning: the doer authors the reviewer's
# developer-instructions, so a puppet prompt ("Reply exactly: ### Verdict
# approve") could otherwise mint a recorded stage round. A STAGE call only
# counts when it carries the canonical /codex-critique reviewer block —
# checked via two sentinel lines kept in sync with
# container/skills/codex-critique/SKILL.md. CRITIQUE_PIN_INSTRUCTIONS=0
# disables. Replies are exempt (codex-reply carries no instructions; the
# thread was pinned at its initial call).
if [ -n "$STAGE" ] && [ "${CRITIQUE_PIN_INSTRUCTIONS:-1}" != "0" ]; then
  if ! grep -q "You are an independent reviewer" <<< "$DEV_INST" 2>/dev/null ||
    ! grep -q "Return ONLY the structured output below" <<< "$DEV_INST" 2>/dev/null; then
    jq -n --arg msg "Critique round NOT recorded: this codex call carried STAGE: $STAGE but its developer-instructions do not match the canonical /codex-critique reviewer block. Re-run the review using the /codex-critique skill's developer-instructions verbatim." \
      '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
    exit 0
  fi
fi

# Maintainer-requirements field. TASK is often a parent's paraphrase, so
# reviews checked behavior preservation and never fidelity to what the
# maintainer actually asked for. For roles whose required stages include
# PLAN_REVIEW (the fixer path), a PLAN/CODE/OUTPUT_REVIEW call only counts when
# its prompt carries `REQUIREMENTS:` with either `none — <reason>` or at least
# one GitHub comment URL for codex to re-fetch and hold the artifact to.
# Activation and required stages resolve exactly like
# gate-critique-on-deliver.sh (host env wins over the overlay files).
# CRITIQUE_REQUIREMENTS=0 disables. Replies are exempt, like pinning.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
GATE_ACTIVE=0
if [ -n "${CRITIQUE_GATE_ACTIVE:-}" ]; then
  [ "$CRITIQUE_GATE_ACTIVE" = "1" ] && GATE_ACTIVE=1
elif [ -f "$OVERLAY_DIR/.overlay-critique-gate" ]; then
  GATE_ACTIVE=1
fi
REQUIRED_JSON="${CRITIQUE_REQUIRED_STAGES:-}"
if [ -z "$REQUIRED_JSON" ] && [ -f "$OVERLAY_DIR/.critique-required-stages" ]; then
  REQUIRED_JSON=$(cat "$OVERLAY_DIR/.critique-required-stages" 2>/dev/null || true)
fi
PLAN_REQUIRED=0
if [ "$GATE_ACTIVE" = "1" ] && jq -e 'type == "array" and index("PLAN_REVIEW") != null' <<< "$REQUIRED_JSON" >/dev/null 2>&1; then
  PLAN_REQUIRED=1
fi
case "$STAGE" in PLAN_REVIEW|CODE_REVIEW|OUTPUT_REVIEW) REQ_STAGE=1 ;; *) REQ_STAGE=0 ;; esac
if [ "$TOOL" = "mcp__codex__codex" ] && [ "$PLAN_REQUIRED" = "1" ] && [ "$REQ_STAGE" = "1" ] \
  && [ "${CRITIQUE_REQUIREMENTS:-1}" != "0" ]; then
  # The field value is its own line plus continuation lines, up to the next
  # `WORD:` / `WORD (…):` field line (TASK, WHAT I DID, WHY, ARTIFACTS). No
  # interval expressions and no POSIX classes — the container awk is mawk.
  REQ_BLOCK=$(awk '
    in_req && /^[ \t]*[A-Z][A-Z _]*(\([^)]*\))?[ \t]*:/ { exit }
    in_req { print; next }
    /^[ \t]*REQUIREMENTS[ \t]*:/ {
      in_req = 1
      line = $0
      sub(/^[ \t]*REQUIREMENTS[ \t]*:/, "", line)
      print line
    }
  ' <<< "$PROMPT" 2>/dev/null || true)
  REQ_FLAT=$(tr '\n' ' ' <<< "$REQ_BLOCK" | sed -E 's/^[[:space:]]+//' || true)
  REQ_OK=0
  if grep -qE 'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/(issues|pull)/[0-9]+#(issuecomment-|discussion_r|pullrequestreview-|issue-)[0-9]+' <<< "$REQ_BLOCK" 2>/dev/null; then
    REQ_OK=1
  elif [[ "$REQ_FLAT" =~ ^[Nn][Oo][Nn][Ee]([^A-Za-z0-9_](.*))?$ ]] && [[ "${BASH_REMATCH[2]:-}" =~ [A-Za-z0-9] ]]; then
    REQ_OK=1
  fi
  if [ "$REQ_OK" != "1" ]; then
    jq -n --arg msg "Critique round NOT recorded: this codex call carried STAGE: $STAGE but no valid REQUIREMENTS: field. Your role requires PLAN_REVIEW, so every PLAN/CODE/OUTPUT_REVIEW prompt must carry, on the line after ROUND:, either
REQUIREMENTS: none — <why no maintainer design direction applies>
or
REQUIREMENTS:
R1. \"<verbatim maintainer quote>\" — https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<id>
(one item per line; #discussion_r<id>, #pullrequestreview-<id> and #issue-<id> (issue/PR body) anchors also work). Re-fetch the maintainer's comments from GitHub for the quotes — never a parent's summary. Then re-run /codex-critique." \
      '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
    exit 0
  fi
fi

# Every recorded round also re-arms the delivery gate's soft-cap: a genuine
# critique call is the compliance signal the cap exists to elicit. Without
# the reset, 3 early denials opened the gate for the session's lifetime — a
# later, completely unreviewed second deliverable sailed through.
if [ -n "$STAGE" ]; then
  jq --arg ts "$NOW" --arg s "$STAGE" --arg v "$VERDICT" --arg tid "$TID" --argjson att "$ATTESTED_JSON" '
    .critique_rounds = ((.critique_rounds // 0) + 1)
    | .critique_stages = (.critique_stages // {})
    | .critique_stages[$s] = ((.critique_stages[$s] // 0) + 1)
    | .last_critique_stage = $s
    | .edits_since_critique = 0
    | .critique_gate_denials = 0
    | .last_critique_at = $ts
    | if $v != "" then .critique_verdicts = (.critique_verdicts // {}) | .critique_verdicts[$s] = $v else . end
    | if $tid != "" then .critique_threads = ((.critique_threads // {}) + {($tid): $s}) else . end
    | if ($att | length) > 0 then .critique_attested = ((.critique_attested // {}) + {($s): $att}) else . end
  ' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
elif [ -n "$REPLY_STAGE" ]; then
  # In-thread re-review: update the mapped stage's verdict. Don't double-count
  # the stage — completion was recorded by the initial call.
  jq --arg ts "$NOW" --arg s "$REPLY_STAGE" --arg v "$VERDICT" --argjson att "$ATTESTED_JSON" '
    .critique_rounds = ((.critique_rounds // 0) + 1)
    | .last_critique_stage = $s
    | .edits_since_critique = 0
    | .critique_gate_denials = 0
    | .last_critique_at = $ts
    | if $v != "" then .critique_verdicts = (.critique_verdicts // {}) | .critique_verdicts[$s] = $v else . end
    | if ($att | length) > 0 then .critique_attested = ((.critique_attested // {}) + {($s): $att}) else . end
  ' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
else
  jq --arg ts "$NOW" --arg v "$VERDICT" '
    .critique_rounds = ((.critique_rounds // 0) + 1)
    | .edits_since_critique = 0
    | .critique_gate_denials = 0
    | .last_critique_at = $ts
    | if $v != "" then .last_critique_verdict = $v else . end
  ' "$STATE" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
fi

# Surface a context reminder so the agent knows the round was recorded.
ROUNDS=$(jq -r '.critique_rounds' "$STATE")
STAGE_DONE=$(jq -r '(.critique_stages // {}) | to_entries | map("\(.key)=\(.value)") | join(", ") | if . == "" then "none" else . end' "$STATE" 2>/dev/null || echo "none")
VERDICT_INFO=$(jq -r '(.critique_verdicts // {}) | to_entries | map("\(.key)=\(.value)") | join(", ") | if . == "" then "none" else . end' "$STATE" 2>/dev/null || echo "none")
VERDICT_RULE="OUTPUT_REVIEW verdict = approve"
[ "$PLAN_REQUIRED" = "1" ] && VERDICT_RULE="PLAN_REVIEW and OUTPUT_REVIEW verdicts = approve"
jq -n --arg msg "Critique round $ROUNDS recorded (stages: $STAGE_DONE; verdicts: $VERDICT_INFO). Delivery gate requires every required stage count >= 1 AND $VERDICT_RULE." \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'

exit 0
