#!/usr/bin/env bash
# Pre-task gate for slang-perf-analyst: decide, for zero tokens, whether tonight's
# compile-perf nightly needs the agent.
#
# Contract (ncl tasks create --script): bash, 30 s, last stdout line is JSON
#   {"wakeAgent": <bool>, "data": {...}}
# and the script exits 0 on every path. A non-zero exit counts as a failed run and
# repeated failures back the series off and then auto-pause it, so errors are
# reported through the payload, never through the exit code.
#
# Wake only for a CONFIRMED REGRESSION: the nightly job succeeded (the sweep ran and
# was archived) and its analyze job failed (the trend step found a regression that
# reproduced on rerun). A failed sweep is an infrastructure problem the CI
# maintainer already covers; there is nothing to analyze.
#
# State lives under the group workspace, and the agent, not this script, marks a run
# analyzed (ledger below): a wake that dies before finishing is retried at the next
# fire instead of being silently dropped.
#
# Every `gh` capture is shape-validated. `gh api` prints its error body on stdout, so
# `$(gh ... || echo 0)` appends instead of replacing, and an unvalidated body reads
# as valid empty data (the 2026-07 failure that turned an API hiccup into silence).
set -uo pipefail

REPO="${PERF_REPO:-shader-slang/slang}"
WORKFLOW="${PERF_WORKFLOW:-nightly-mdl-perf-test.yml}"
STATE="${PERF_STATE_DIR:-/workspace/agent/memory}"
LEDGER="$STATE/perf-analyzed.json"        # JSON array of analyzed run ids, written by the agent
ERROR_STAMP="$STATE/.perf-gate-last-error" # epoch of the last error wake
MAX_AGE_H="${PERF_MAX_AGE_H:-36}"
ERROR_WAKE_EVERY_S="${PERF_ERROR_WAKE_EVERY_S:-21600}"

emit() { # emit <wake true|false> <data json>
  jq -nc --argjson wake "$1" --argjson data "$2" '{wakeAgent: $wake, data: $data}' ||
    printf '{"wakeAgent":true,"data":{"error":"gate_output_failed"}}\n'
  exit 0
}

# An error wakes the agent at most once per ERROR_WAKE_EVERY_S, so an outage is
# reported without spending tokens on every fire.
fail() { # fail <reason>
  local now last
  now=$(date +%s)
  last=$(cat "$ERROR_STAMP" 2>/dev/null || echo 0)
  case "$last" in '' | *[!0-9]*) last=0 ;; esac
  if [ $((now - last)) -ge "$ERROR_WAKE_EVERY_S" ]; then
    mkdir -p "$STATE" 2>/dev/null && printf '%s' "$now" >"$ERROR_STAMP" 2>/dev/null
    emit true "$(jq -nc --arg e "$1" '{error: $e}')"
  fi
  emit false "$(jq -nc --arg e "$1" '{error: $e, suppressed: true}')"
}

command -v jq >/dev/null 2>&1 || { printf '{"wakeAgent":true,"data":{"error":"jq_missing"}}\n'; exit 0; }
command -v gh >/dev/null 2>&1 || fail "gh_missing"

runs=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 6 \
  --json databaseId,conclusion,status,createdAt,headSha,event,url 2>/dev/null) || fail "run_list_failed"
printf '%s' "$runs" | jq -e 'type == "array" and all(.[]; type == "object" and (.databaseId | type == "number"))' \
  >/dev/null 2>&1 || fail "run_list_unparseable"

seen='[]'
if [ -f "$LEDGER" ]; then
  seen=$(jq -c 'if type == "array" then . else [] end' "$LEDGER" 2>/dev/null) || seen='[]'
fi
now=$(date +%s)

# Newest first (gh run list order). Walk until one needs the agent.
count=$(printf '%s' "$runs" | jq 'length')
i=0
while [ "$i" -lt "$count" ]; do
  run=$(printf '%s' "$runs" | jq -c ".[$i]")
  i=$((i + 1))
  id=$(printf '%s' "$run" | jq -r '.databaseId')
  status=$(printf '%s' "$run" | jq -r '.status')
  conclusion=$(printf '%s' "$run" | jq -r '.conclusion')
  created=$(printf '%s' "$run" | jq -r '.createdAt')
  [ "$status" = "completed" ] || continue
  [ "$conclusion" = "failure" ] || continue
  printf '%s' "$seen" | jq -e --argjson id "$id" 'index($id) != null' >/dev/null 2>&1 && continue
  created_s=$(date -u -d "$created" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$created" +%s 2>/dev/null) || continue
  [ $((now - created_s)) -le $((MAX_AGE_H * 3600)) ] || continue

  jobs=$(gh run view "$id" --repo "$REPO" --json jobs 2>/dev/null) || fail "run_view_failed"
  printf '%s' "$jobs" | jq -e '.jobs | type == "array"' >/dev/null 2>&1 || fail "run_view_unparseable"
  nightly=$(printf '%s' "$jobs" | jq -r '[.jobs[] | select(.name == "nightly")][0].conclusion // "missing"')
  analyze=$(printf '%s' "$jobs" | jq -r '[.jobs[] | select(.name == "analyze")][0].conclusion // "missing"')
  if [ "$nightly" = "success" ] && [ "$analyze" = "failure" ]; then
    emit true "$(printf '%s' "$run" | jq -c '{run_id: .databaseId, run_url: .url, created_at: .createdAt, head_sha: .headSha, event: .event, kind: "regression"}')"
  fi
  # nightly failed or analyze never ran: a sweep problem, not a regression. Not ours.
done

emit false "$(jq -nc --argjson n "$count" '{checked_runs: $n}')"
