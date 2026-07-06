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
#
# Force-push gates intentionally NOT wired in v1 — too noisy for legitimate
# rebases of feature branches; revisit if abuse pattern emerges.
#
# Stdin: JSON with tool_name, tool_input. Exit 0 = allow, exit 2 = deny.
set -euo pipefail

# Opt-in gate — overlay-marker check (Model A symmetric opt-in).
# Path is overridable for testing; container default is /workspace/agent/.
OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"
[ -f "$OVERLAY_DIR/.overlay-critique-gate" ] || exit 0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // .tool_input.command // ""')

HIT=""
case "$TOOL" in
  mcp__nanoclaw__send_message)
    # Anchored to line start (the chain protocol emits markers as message /
    # line prefixes). Unanchored matching burned a denial — and one of the
    # session's 3 soft-cap strikes — every time an agent merely MENTIONED a
    # marker mid-sentence in a status update.
    if echo "$TEXT" | grep -qE '^[[:space:]]*\[(Fix Report|Resolution|Triage Resolution|Review Verdict|handoff)\]'; then
      HIT="delivery/handoff message"
    fi
    ;;
  Bash)
    if echo "$TEXT" | grep -qE '(gh pr create|gh api [^|]*pulls\b)'; then
      HIT="PR creation"
    fi
    ;;
esac

[ -z "$HIT" ] && exit 0

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

# Required-stages enforcement (per-overlay opt-in via .critique-required-stages,
# materialized by the composer from the matched overlays' frontmatter).
# Without that file, fall back to the historical "any 1 critique round" check
# so coworkers using the bare critique-gate overlay keep working unchanged.
REQUIRED_FILE="$OVERLAY_DIR/.critique-required-stages"
DENIAL_REASON=""

if [ -f "$REQUIRED_FILE" ] && jq -e 'length > 0' "$REQUIRED_FILE" >/dev/null 2>&1; then
  DONE=$(jq -c '.critique_stages // {}' "$STATE" 2>/dev/null || echo '{}')
  VERDICTS=$(jq -c '.critique_verdicts // {}' "$STATE" 2>/dev/null || echo '{}')
  MISSING=$(jq -r --argjson done "$DONE" '
    map(select(($done[.] // 0) < 1)) | join(", ")
  ' "$REQUIRED_FILE" 2>/dev/null || echo "")
  if [ -n "$MISSING" ]; then
    DENIAL_REASON="missing critique stages: $MISSING"
  fi
  # OUTPUT_REVIEW verdict gate: count>=1 is not enough — last verdict must be
  # "approve". This prevents delivering with an un-reverified must-fix output.
  # Fails CLOSED when OUTPUT_REVIEW is required but no verdict was recorded:
  # a missing verdict means the recorder couldn't parse one, and 33% of June
  # stage-rounds had no recorded verdict — passing those count-only is exactly
  # the leak the verdict gate exists to close. CRITIQUE_VERDICT_STRICT=0
  # restores the legacy count-only fallthrough.
  if [ -z "$DENIAL_REASON" ] && jq -e 'index("OUTPUT_REVIEW")' "$REQUIRED_FILE" >/dev/null 2>&1; then
    OUTPUT_VERDICT=$(echo "$VERDICTS" | jq -r '.OUTPUT_REVIEW // empty' 2>/dev/null || true)
    if [ -n "$OUTPUT_VERDICT" ] && [ "$OUTPUT_VERDICT" != "approve" ]; then
      DENIAL_REASON="OUTPUT_REVIEW last verdict is \"$OUTPUT_VERDICT\" (must be \"approve\"). Re-run /codex-critique with STAGE: OUTPUT_REVIEW after fixing the issues"
    elif [ -z "$OUTPUT_VERDICT" ] && [ "${CRITIQUE_VERDICT_STRICT:-1}" != "0" ]; then
      DENIAL_REASON="OUTPUT_REVIEW ran but no verdict was recorded (missing or unparseable). Re-run /codex-critique with STAGE: OUTPUT_REVIEW and make sure codex returns a '### Verdict' section containing approve or must-fix"
    fi
  fi
else
  ROUNDS=$(jq -r '.critique_rounds // 0' "$STATE" 2>/dev/null || echo 0)
  if [ "$ROUNDS" -lt 1 ]; then
    DENIAL_REASON="no critique rounds recorded (critique_rounds=$ROUNDS)"
  fi
fi

if [ -n "$DENIAL_REASON" ]; then
  # Soft cap: track gate denials. After 3 denies in a single session, the gate
  # stops denying and yields with a "stuck" warning. Prevents the 100-deny
  # pathology where a confused agent never learns to comply and burns turns
  # retrying. Threshold is intentionally low — the gate's job is to surface
  # the requirement, not to be an infinite wall.
  DENIALS=$(jq -r '.critique_gate_denials // 0' "$STATE" 2>/dev/null || echo 0)
  if [ "$DENIALS" -ge 3 ]; then
    cat >&2 << EOF
[critique-gate soft-fail] Allowing $HIT despite unresolved requirement
($DENIAL_REASON). The gate denied this session 3 times already; further
denials would just thrash. If the agent is consistently bypassing critique,
the workflow / overlay setup needs review.
EOF
    exit 0
  fi
  jq '.critique_gate_denials = ((.critique_gate_denials // 0) + 1)' "$STATE" > "$STATE.tmp" 2>/dev/null && mv "$STATE.tmp" "$STATE" || true
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
