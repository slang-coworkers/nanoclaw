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

HIT=""
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

[ -z "$HIT" ] && exit 0

# ABSTAIN fast-path (PR-approver): an [Approval Decision] whose state is
# ABSTAIN_POLICY / ABSTAIN_INFRA makes NO positive claim about the code — it
# routes the PR to a human ("must look" / pipeline couldn't decide). Those
# states are not critique-gated: only WOULD_APPROVE and BLOCK (the states that
# assert something) require DECISION_REVIEW + OUTPUT_REVIEW. Relaxing here is
# safe because an abstain never auto-approves; the worst an agent could do by
# mislabelling a WOULD_APPROVE as an abstain is decline to approve. Matched on
# the decision token in the delivered message, anchored so a mid-sentence
# mention of the word doesn't trip it. CRITIQUE_ABSTAIN_FASTPATH=0 disables.
if [ "$TOOL" = "mcp__nanoclaw__send_message" ] && [ "${CRITIQUE_ABSTAIN_FASTPATH:-1}" != "0" ]; then
  if grep -qE '\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b' <<< "$TEXT" \
     && ! grep -qE '\b(WOULD_APPROVE|BLOCK)\b' <<< "$TEXT"; then
    exit 0
  fi
fi

STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"

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
CRITIQUE REQUIRED before $HIT — denial cap reached (self-heal attempt $ATTEMPTS).

Reason: $DENIAL_REASON.

Run /codex-critique for the stage named above, then retry. The gate will NOT
open on its own; there is no timeout. If you genuinely cannot run the
critique, say why in this session and an admin will be asked.
EOF
      fi
      exit 2
    fi
    jq -n --arg reason "$DENIAL_REASON" --arg hit "$HIT" --argjson at "$NOW_EPOCH" --argjson denials "$DENIALS" \
      '{requested_at: $at, reason: $reason, hit: $hit, denials: $denials}' > "$ESC_FILE" 2>/dev/null || true
    cat >&2 << EOF
CRITIQUE REQUIRED before $HIT — denial cap reached; escalation opened.

Reason: $DENIAL_REASON.

Run /codex-critique for the stage named above, then retry the $HIT. The gate
does not time out and will not open on its own. If you cannot run the
critique, say why in this session — after repeated attempts an admin is asked.
EOF
    exit 2
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
