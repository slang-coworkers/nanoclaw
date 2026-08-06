#!/usr/bin/env bash
# Tests for cron-run.sh.
#
# The wrapper exists so a nonzero exit cannot be lost. Every case here pins a way
# it could lose one anyway — most importantly that the wrapper's OWN bookkeeping
# can never become the exit status, which is the trailing-`mv` bug that made
# funnel-cron.sh report success for every failure it ever had.
#
# Run: bash scripts/test-cron-run.sh
set -u

WRAP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cron-run.sh"
PASS=0
FAIL=0

setup() {
  WORK="$(mktemp -d)"
  export CRON_RUN_STATE_DIR="$WORK/state"
  export CRON_RUN_LOG="$WORK/cron-failures.log"
}

ok() { PASS=$((PASS + 1)); }
bad() {
  FAIL=$((FAIL + 1))
  echo "  ✗ $1"
}

expect_rc() {
  local want="$1" got="$2" what="$3"
  if [ "$got" -eq "$want" ]; then ok; else bad "$what: expected rc=$want, got rc=$got"; fi
}
expect_file() {
  if [ -f "$1" ]; then ok; else bad "$2: expected $1 to exist"; fi
}
expect_no_file() {
  if [ ! -f "$1" ]; then ok; else bad "$2: expected $1 NOT to exist"; fi
}
expect_grep() {
  if grep -q "$1" "$2" 2>/dev/null; then ok; else bad "$3: expected /$1/ in $2"; fi
}
jq_field() { python3 -c "import json,sys;print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$1" "$2" 2>/dev/null; }

echo "== the wrapped command's exit status is the wrapper's =="
setup
bash "$WRAP" ok-job true; expect_rc 0 $? "success passes through"
bash "$WRAP" fail-job bash -c 'exit 42'; expect_rc 42 $? "rc=42 passes through"
bash "$WRAP" missing-job definitely-not-a-real-binary 2>/dev/null; expect_rc 127 $? "rc=127 passes through"
bash "$WRAP" sig-job bash -c 'kill -TERM $$'; expect_rc 143 $? "signal status passes through"

echo "== a failure leaves a marker naming the job =="
setup
bash "$WRAP" kb-doctor bash -c 'exit 2' >/dev/null 2>&1
M="$CRON_RUN_STATE_DIR/kb-doctor.json"
expect_file "$M" "marker written"
[ "$(jq_field "$M" job)" = "kb-doctor" ] && ok || bad "marker records the job name"
[ "$(jq_field "$M" exitCode)" = "2" ] && ok || bad "marker records the real exit code"
[ "$(jq_field "$M" consecutiveFailures)" = "1" ] && ok || bad "first failure counts 1"
expect_grep "CRON FAILURE job=kb-doctor rc=2" "$CRON_RUN_LOG" "log line names job and rc"

echo "== repeated failures accumulate, first-seen is preserved =="
setup
bash "$WRAP" flaky bash -c 'exit 3' >/dev/null 2>&1
FIRST="$(jq_field "$CRON_RUN_STATE_DIR/flaky.json" firstFailedAt)"
sleep 1
bash "$WRAP" flaky bash -c 'exit 3' >/dev/null 2>&1
M="$CRON_RUN_STATE_DIR/flaky.json"
[ "$(jq_field "$M" consecutiveFailures)" = "2" ] && ok || bad "second failure counts 2"
[ "$(jq_field "$M" firstFailedAt)" = "$FIRST" ] && ok || bad "firstFailedAt survives (failing SINCE, not just today)"

echo "== recovery clears the marker so a fixed job stops shouting =="
setup
bash "$WRAP" recov bash -c 'exit 1' >/dev/null 2>&1
expect_file "$CRON_RUN_STATE_DIR/recov.json" "marker present while failing"
bash "$WRAP" recov true >/dev/null 2>&1; expect_rc 0 $? "recovery still exits 0"
expect_no_file "$CRON_RUN_STATE_DIR/recov.json" "marker cleared on success"
expect_grep "CRON RECOVERED job=recov" "$CRON_RUN_LOG" "recovery is logged"

echo "== a clean run is silent: no marker, no log noise =="
setup
bash "$WRAP" quiet-job true >/dev/null 2>&1
expect_no_file "$CRON_RUN_STATE_DIR/quiet-job.json" "no marker on success"
if [ ! -s "$CRON_RUN_LOG" ]; then ok; else bad "a passing job should not write to the failure log"; fi

echo "== jobs are independent: one failing does not touch another =="
setup
bash "$WRAP" job-a bash -c 'exit 1' >/dev/null 2>&1
bash "$WRAP" job-b true >/dev/null 2>&1
expect_file "$CRON_RUN_STATE_DIR/job-a.json" "job-a marker kept"
expect_no_file "$CRON_RUN_STATE_DIR/job-b.json" "job-b unaffected"

echo "== THE OWN GOAL: bookkeeping failure must not mask the command's rc =="
setup
# State dir is an unwritable FILE, so every marker write fails.
rm -rf "$CRON_RUN_STATE_DIR"; : > "$CRON_RUN_STATE_DIR"
bash "$WRAP" blocked bash -c 'exit 42' >/dev/null 2>&1
expect_rc 42 $? "rc survives an unwritable state dir"
setup
rm -rf "$(dirname "$CRON_RUN_LOG")"; mkdir -p "$(dirname "$CRON_RUN_LOG")"; : > "$CRON_RUN_LOG"; chmod 400 "$CRON_RUN_LOG"
bash "$WRAP" rolog bash -c 'exit 7' >/dev/null 2>&1
expect_rc 7 $? "rc survives an unwritable log"
chmod 600 "$CRON_RUN_LOG" 2>/dev/null || true
setup
# python3 unavailable -> marker cannot be written, rc must still pass through.
PDIR="$(mktemp -d)"; printf '#!/bin/sh\nexit 1\n' > "$PDIR/python3"; chmod +x "$PDIR/python3"
PATH="$PDIR:$PATH" bash "$WRAP" nopy bash -c 'exit 9' >/dev/null 2>&1
expect_rc 9 $? "rc survives python3 failing"

echo "== stdout/stderr are not swallowed =="
setup
OUT="$(bash "$WRAP" echo-job bash -c 'echo hello-stdout' 2>/dev/null)"
[ "$OUT" = "hello-stdout" ] && ok || bad "stdout passes through (got '$OUT')"
ERR="$(bash "$WRAP" echo-job2 bash -c 'echo hello-stderr >&2' 2>&1 >/dev/null)"
[ "$ERR" = "hello-stderr" ] && ok || bad "stderr passes through (got '$ERR')"

echo "== usage errors are refused, not silently treated as a job =="
setup
bash "$WRAP" >/dev/null 2>&1; expect_rc 64 $? "no args"
bash "$WRAP" lonely-job >/dev/null 2>&1; expect_rc 64 $? "job name but no command"

echo "== arguments with spaces survive intact =="
setup
bash "$WRAP" spacey bash -c 'test "$1" = "a b c"' _ "a b c" >/dev/null 2>&1
expect_rc 0 $? "quoted argument reaches the command unsplit"

echo
echo "PASS $PASS  FAIL $FAIL"
[ "$FAIL" -eq 0 ]
