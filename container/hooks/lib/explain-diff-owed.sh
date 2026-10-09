# shellcheck shell=bash
# Sourced, not executed. The one definition of "this PR's explanation comment no
# longer explains its head", shared by the two gates that enforce the refresh
# (gate-explain-on-stop.sh, gate-critique-on-deliver.sh). pr-auto-map.sh writes
# the receipts this reads.
#
# Receipts live in their own per-session file, NOT workflow-state.json: that
# file is reset on every inbound message and after 10 min idle
# (workflow-state-reset.sh), and a refresh owed before the reset is still owed
# after it. Shape:
#
#   { "seq": 7,
#     "prs":    { "owner/repo#N": { repo, number, branch|null, created_at, created_seq,
#                                   explained_head, explained_at, explained_seq } },
#     "pushes": { "owner/repo:branch": { repo, branch, head|null, pushed_at, seq } },
#     "events": [ { event: "stop_block"|"deliver_refusal", at, seq, owed: [lines] }, … ] }
#
# `seq` is a per-file counter bumped on every receipt, so ordering never depends
# on two events landing in different wall-clock seconds. `events` (last 100) is the
# gates' firing log: it does not bump `seq` and nothing reads it but an operator
# counting how often the once-only Stop block fires or is escaped.
#
# A PR owes a refresh when it was never explained, or when a push to its repo
# (and its branch, when known) is newer than its last explanation and names a
# different head. Repos compare by NAME (owner dropped): a fixer pushes to its
# fork and opens the PR on upstream, and git's push report only names the fork.

EXPLAIN_DIFF_STATE="${EXPLAIN_DIFF_STATE_FILE:-/workspace/.claude/explain-diff-state.json}"

# Input: the receipts file. Output: one line per PR that owes a refresh.
# shellcheck disable=SC2016  # jq program, not shell
EXPLAIN_DIFF_OWED_JQ='
  def rname: ascii_downcase | split("/") | last;
  def same_head($a; $b):
    ($a // "" | ascii_downcase) as $x | ($b // "" | ascii_downcase) as $y
    | ($x | length) >= 7 and ($y | length) >= 7
      and (($x | startswith($y)) or ($y | startswith($x)));
  [ (.pushes // {})[] | select(type == "object") ] as $pushes
  | (.prs // {}) | to_entries[]
  | .key as $k | (.value | select(type == "object")) as $pr
  | ([ $pushes[]
       | select(((.repo // "") | rname) == (($pr.repo // ($k | split("#")[0])) | rname))
       | select($pr.branch == null or .branch == $pr.branch) ]
     | max_by(.seq // 0)) as $last
  | select(
      $pr.explained_seq == null
      or ($last != null
          and (($last.seq // 0) > $pr.explained_seq)
          and (same_head($last.head; $pr.explained_head) | not)))
  | (if $last != null and ($last.head // "") != "" then "pushed \($last.head[0:7]) to \($k)"
     elif $last != null then "pushed to \($k)"
     else "opened \($k)" end)
    + "; its explanation comment still explains "
    + (if ($pr.explained_head // "") != "" then "head \($pr.explained_head[0:7])" else "nothing" end)
'

# Print one "<what happened>; its explanation comment still explains <what>" line per
# PR that owes a refresh; print nothing when none does or there are no receipts.
explain_diff_owed_lines() {
  local f="${1:-$EXPLAIN_DIFF_STATE}"
  [ -f "$f" ] || return 0
  jq -r "$EXPLAIN_DIFF_OWED_JQ" "$f" 2>/dev/null || true
}

# Append one firing record to `.events` in the receipts file. Never fails the
# caller (the gates run under set -e) and never bumps `seq`.
# Usage: explain_diff_log_event <event> "<owed lines>"
explain_diff_log_event() {
  local event="$1" owed="${2:-}" f="${3:-$EXPLAIN_DIFF_STATE}" cur='{}' now
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  mkdir -p "$(dirname "$f")" 2>/dev/null || return 0
  if [ -s "$f" ] && jq -e 'type == "object"' "$f" >/dev/null 2>&1; then
    cur=$(cat "$f")
  fi
  if jq --arg event "$event" --arg now "$now" --arg owed "$owed" \
    '.events = (((.events // []) + [{event: $event, at: $now, seq: (.seq // 0),
        owed: ($owed | split("\n") | map(select(length > 0)))}]) | .[-100:])' \
    <<< "$cur" > "$f.tmp.$$" 2>/dev/null; then
    mv "$f.tmp.$$" "$f" 2>/dev/null || rm -f "$f.tmp.$$" 2>/dev/null || true
  else
    rm -f "$f.tmp.$$" 2>/dev/null || true
  fi
  return 0
}

# Same activation rule as gate-critique-on-deliver.sh: the host-injected env var
# is authoritative when set; the overlay marker file is the fallback.
explain_diff_gate_active() {
  if [ -n "${CRITIQUE_GATE_ACTIVE:-}" ]; then
    [ "$CRITIQUE_GATE_ACTIVE" = "1" ] || return 1
  else
    [ -f "${OVERLAY_MARKER_DIR:-/workspace/agent}/.overlay-critique-gate" ] || return 1
  fi
  [ "${EXPLAIN_DIFF_GATE:-1}" != "0" ]
}
