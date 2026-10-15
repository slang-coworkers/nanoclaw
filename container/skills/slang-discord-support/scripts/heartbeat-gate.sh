#!/bin/bash
# Heartbeat pre-check: Discord new messages + CI health + summon requests
#
# Credentials come from the OneCLI gateway: we deliberately KEEP the proxy env
# and send NO Authorization header — the gateway injects the vault "Discord Bot"
# secret for discord.com (and the App token for api.github.com). The previous
# version unset the proxy and read a raw token from memory/.discord-token, which
# silently rotted on 2026-07-11 and 401'd for weeks.

MEM=/workspace/agent/memory
SUMMON_FILE="$MEM/feedback/summon_requests.jsonl"
SUMMON_HANDLED="$MEM/feedback/summon_handled.jsonl"
LAST_TS_FILE="$MEM/.heartbeat-last-ts"
GUILD_ID=1303735196696445038

LAST_TS=$(cat "$LAST_TS_FILE" 2>/dev/null || echo "1970-01-01T00:00:00Z")
UA="User-Agent: curl/8.0"

wake=false

# Hard time budget. The runner (task-script.ts) SIGKILLs this pre-script at 30s
# and DISCARDS its output -> a silent script-skip:error, no report at all. The
# sequential curls below (a 3-try auth probe, a per-thread scan that used to be
# unbounded, three workflow repos) can exceed 30s on a slow OneCLI proxy, which
# is exactly the intermittent script-skip we're fixing. Bound total network to
# ~20s; once past it, every section short-circuits to wake=true (fail toward
# answering, consistent with the guards below) so the run REACHES the JSON
# output and reports instead of being killed with nothing.
HB_DEADLINE=$(( $(date -u +%s) + 20 ))
past_deadline() { [ "$(date -u +%s)" -ge "$HB_DEADLINE" ]; }

# 1. Pending summon requests
#
# TWO counts, deliberately. The Discord wiring (session_mode=per-thread) already
# wakes a per-thread session on every summon AND every follow-up in the forums it
# reaches -- so for those threads this heartbeat is a DUPLICATE answerer, not a
# safety net. On 2026-08-08 both paths answered thread 1535675765155303506 and the
# user saw two overlapping answers to one question; the race window is
# research->send (~22 min: summon 15:47:13, first sends 16:09), not send->ledger,
# which is why appending to summon_handled.jsonl cannot fix it.
#
# So only STALE summons vote to wake: if a summon is older than the grace period
# and still unhandled, the adapter demonstrably did not take it (dead wake, a forum
# the wiring doesn't cover, or a crash mid-research) and we are the fallback.
# Fresh ones are reported but never wake -- they belong to the adapter.
#
# Grace = 20 min: comfortably longer than an observed adapter answer (~22 min
# summon->send was research time, and its FIRST message landed at 16:09 = 22 min;
# a wake that is going to happen happens within ~1 min of the summon row).
# NOTE: not narrowed to "only forums the wiring misses" -- I have positive evidence
# path A covers parent 1313936640661524601 (76/89 requests, and every request since
# June) but NO evidence either way for 1494023079666647200 / 1337094433816051813,
# and no recent traffic there to test with. An age gate is safe for all three
# without needing that unknown resolved: it cannot race the adapter, and it still
# catches a forum the adapter silently ignores (just 20 min later).
SUMMON_GRACE_MIN="${SUMMON_GRACE_MIN:-20}"
pending=0        # all unhandled (reporting only)
pending_stale=0  # unhandled AND older than the grace period (wake-worthy)
now_epoch=$(date -u +%s)
if [ -f "$SUMMON_FILE" ]; then
  handled_ids=""
  [ -f "$SUMMON_HANDLED" ] && handled_ids=$(jq -r '.thread_id // empty' "$SUMMON_HANDLED" 2>/dev/null | sort -u)
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    tid=$(echo "$line" | jq -r '.thread_id // empty' 2>/dev/null)
    [ -z "$tid" ] && continue
    echo "$handled_ids" | grep -qx "$tid" && continue
    pending=$((pending + 1))
    # Age from the request row's own timestamp. Unparseable/missing => treat as
    # stale, so a schema change fails toward answering rather than toward silence.
    sts=$(printf '%s' "$line" | jq -r '.timestamp // empty' 2>/dev/null)
    s_epoch=""
    [ -n "$sts" ] && s_epoch=$(date -u -d "$sts" +%s 2>/dev/null || echo "")
    if [ -z "$s_epoch" ]; then
      pending_stale=$((pending_stale + 1))
    elif [ $(( (now_epoch - s_epoch) / 60 )) -ge "$SUMMON_GRACE_MIN" ]; then
      pending_stale=$((pending_stale + 1))
    fi
  done < "$SUMMON_FILE"
fi
[ "$pending_stale" -gt 0 ] && wake=true

# 2. Discord new messages (auth injected by OneCLI — no Authorization header)
new_count=0
discord_auth_ok=1
# Retry the auth probe before declaring an auth break. A SINGLE un-retried probe
# turned a transient proxy 503 into discord_auth_ok=0, which skipped the whole
# Discord scan and reported new_discord_messages=0 -- a NULL reading that reads
# as "quiet". Combined with the quiet-path watermark stamp that marked those
# unread messages as read, it cost a user 2h10m on 2026-08-07. Re-probed 6/6 OK
# minutes later, so the credential was never bad.
discord_auth_ok=0
for _try in 1 2 3; do
  past_deadline && break
  if curl -sf --max-time 6 -H "$UA" "https://discord.com/api/v10/users/@me" >/dev/null 2>&1; then
    discord_auth_ok=1; break
  fi
  [ "$_try" -lt 3 ] && sleep 1
done
if [ "$discord_auth_ok" = "1" ]; then
  for ch in 1305995870046650368 1303735244108595330; do
    n=$(curl -sf --max-time 6 -H "$UA" "https://discord.com/api/v10/channels/$ch/messages?limit=5" \
      | jq --arg ts "$LAST_TS" '[.[] | select(.timestamp > $ts and (.author.bot | not))] | length' 2>/dev/null) || n=0
    new_count=$((new_count + n))
  done
  threads=$(curl -sf --max-time 6 -H "$UA" "https://discord.com/api/v10/guilds/$GUILD_ID/threads/active" \
    | jq -r '.threads[] | select(.parent_id == "1313936640661524601" or .parent_id == "1494023079666647200" or .parent_id == "1337094433816051813") | .id' 2>/dev/null) || threads=""
  _scanned=0
  for tid in $threads; do
    past_deadline && break
    _scanned=$((_scanned + 1)); [ "$_scanned" -gt 8 ] && break
    n=$(curl -sf --max-time 6 -H "$UA" "https://discord.com/api/v10/channels/$tid/messages?limit=3" \
      | jq --arg ts "$LAST_TS" '[.[] | select(.timestamp > $ts and (.author.bot | not))] | length' 2>/dev/null) || n=0
    new_count=$((new_count + n))
    [ "$new_count" -gt 0 ] && break
  done
fi
[ "$new_count" -gt 0 ] && wake=true
# Surface an auth break instead of silently reporting "no new messages".
[ "$discord_auth_ok" = "0" ] && wake=true


# 3. CI health
#
# Read the newest snapshot as the last COMPLETE line of a byte-range tail.
#
# A fixed byte range ignores line boundaries: the slice starts mid-line, so if the
# newest record is longer than the range, that record is truncated at its head and
# `grep '^{'` matches nothing -- the pipeline emits empty, which reads identically
# to "CI is quiet". Measured 2026-08-06: 291/5463 lines were >=2048B, and the
# failure is biased 34x TOWARD the wake condition (16% oversized when
# jobs_queued>30 vs 0.5% when quiet), because record width grows with the number
# of runner/queue/quota groups -- i.e. with the activity this alarm watches. So the
# alarm was most likely to be suppressed exactly when it should fire.
#
# Widening the constant alone only defers the bug, so correctness here must not
# depend on it: take the last line that both starts with `{` AND parses as JSON.
# `jq -e .` is the boundary test -- a head-truncated fragment fails it, a complete
# record passes. The range is now only a throughput knob, not a correctness one.
CI_RANGE="${CI_RANGE:-32768}"
if past_deadline; then
  ci_snap_raw=""; ci_curl_rc=124   # past budget: skip fetch -> falls through to fetch_failed + wake
else
  ci_snap_raw=$(curl -sf --max-time 6 -r "-${CI_RANGE}" -H "$UA" "https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl" 2>/dev/null)
  ci_curl_rc=$?
fi
ci=""
if [ "$ci_curl_rc" -eq 0 ] && [ -n "$ci_snap_raw" ]; then
  # Walk candidate lines newest-first; first one that parses wins.
  while IFS= read -r _line; do
    case "$_line" in
      \{*)
        if printf '%s' "$_line" | jq -e . >/dev/null 2>&1; then ci="$_line"; break; fi
        ;;
    esac
  done <<< "$(printf '%s\n' "$ci_snap_raw" | tac)"
fi

# Distinguish the failure modes instead of collapsing them to silence: a truncated
# slice is a CONFIG bug (raise CI_RANGE) and must not look like a fetch failure.
if [ -z "$ci" ]; then
  if [ "$ci_curl_rc" -ne 0 ]; then
    ci='{"error":"fetch_failed"}'
  elif [ -z "$ci_snap_raw" ]; then
    ci='{"error":"empty_response"}'
  else
    ci='{"error":"no_complete_line_in_range","ci_range":'"$CI_RANGE"'}'
  fi
  # An unreadable snapshot is itself worth waking for -- previously this path went
  # silent and was indistinguishable from a healthy quiet CI.
  wake=true
fi

# Validate before use: `jq --argjson` aborts the whole script on invalid input,
# which previously turned an empty read into a run that emitted NO JSON at all
# (the `|| ci=...` guard could not fire because `tail` succeeds on empty input).
printf '%s' "$ci" | jq -e . >/dev/null 2>&1 || { ci='{"error":"unparseable_snapshot"}'; wake=true; }

queued=$(printf '%s' "$ci" | jq -r '.jobs_queued // 0' 2>/dev/null)
case "$queued" in ''|*[!0-9-]*) queued=0 ;; esac

# Gate the depth vote on FRAME AGE. A stale snapshot can carry a large jobs_queued
# from a window that has since drained (observed 2026-08-06: 3 byte-identical frames
# claiming queued=70 while the live API said 2). Voting off it wakes the agent to
# investigate a queue that no longer exists; worse, the writer runs on the same
# contended pool it measures, so frames go stale exactly when CI is busy.
ci_ts=$(printf '%s' "$ci" | jq -r '.timestamp // empty' 2>/dev/null)
ci_age_min=-1
if [ -n "$ci_ts" ]; then
  ci_epoch=$(date -u -d "$ci_ts" +%s 2>/dev/null || echo "")
  [ -n "$ci_epoch" ] && ci_age_min=$(( ( $(date -u +%s) - ci_epoch ) / 60 ))
fi
# Depth vote only when the frame is fresh enough to describe NOW (<=45 min; writer
# cadence is ~32 min, so 45 admits one missed beat without admitting a stale window).
if [ "$ci_age_min" -ge 0 ] && [ "$ci_age_min" -le 45 ]; then
  [ "$queued" -gt 30 ] 2>/dev/null && wake=true
fi

# Advance the Discord read-watermark ONLY on the quiet path -- and only AFTER every
# wake vote has been cast. This used to sit above the CI-health block, so a CI-only
# wake (queued>30 / unparseable snapshot) stamped the watermark while wake was still
# false, marking unread Discord messages as read. Latent but real; moved 2026-08-07.
# On a wake the agent stamps it itself, after the report is written, so a wake that
# dies before reporting is retried rather than silently dropped.
if [ "$wake" = "false" ]; then
  date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_TS_FILE" 2>/dev/null || true
fi

# 4. Workflow failures
wf="{}"
for repo in shader-slang/slang shader-slang/slangpy shader-slang/slang-rhi; do
  short=$(echo "$repo" | cut -d/ -f2)
  if past_deadline; then
    runs='{"error":"deadline"}'
  else
    runs=$(curl -sf --max-time 6 -H "$UA" "https://api.github.com/repos/$repo/actions/runs?status=failure&per_page=3" \
      | jq -c '{total: .total_count, runs: [.workflow_runs[:3][] | {name,conclusion,created_at,html_url}]}' 2>/dev/null) || runs='{"error":"fetch_failed"}'
  fi
  # Same unreachable-guard shape as the CI block: on empty curl output `jq` exits 0
  # and `runs` is set to the empty string, so the `||` guard never fires and the
  # accumulator below dies on invalid --argjson. Validate before use.
  printf '%s' "$runs" | jq -e . >/dev/null 2>&1 || runs='{"error":"fetch_failed"}'
  wf=$(printf '%s' "$wf" | jq --argjson r "$runs" --arg k "$short" '. + {($k): $r}') || wf='{"error":"accumulator_failed"}'
done

# Output
# Final assembly. Every --argjson input above is now validated, but keep a
# last-resort guard so a malformed value degrades to a diagnosable payload
# instead of emitting nothing (a run that prints nothing is a silent dropped
# heartbeat, which is the failure mode this whole patch exists to remove).
printf '%s' "$wf" | jq -e . >/dev/null 2>&1 || wf='{"error":"wf_unparseable"}'
case "$new_count" in ''|*[!0-9]*) new_count=0 ;; esac
case "$pending" in ''|*[!0-9]*) pending=0 ;; esac
case "$pending_stale" in ''|*[!0-9]*) pending_stale=0 ;; esac

jq -nc \
  --argjson ci_age_min "$ci_age_min" \
  --argjson wake $wake \
  --argjson ci "$ci" \
  --argjson wf "$wf" \
  --argjson new "$new_count" \
  --argjson pending "$pending" \
  --argjson pending_stale "$pending_stale" \
  --argjson grace "$SUMMON_GRACE_MIN" \
  --argjson dauth "$discord_auth_ok" \
  '{wakeAgent: $wake, data: {ci_health: $ci, ci_frame_age_min: $ci_age_min, workflow_failures: $wf, new_discord_messages: $new, pending_summons: $pending, pending_summons_stale: $pending_stale, summon_grace_min: $grace, discord_auth_ok: ($dauth == 1)}}' \
  || printf '{"wakeAgent":true,"data":{"ci_health":{"error":"output_assembly_failed"}}}\n'