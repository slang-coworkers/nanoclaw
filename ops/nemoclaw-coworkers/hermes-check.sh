#!/usr/bin/env bash
# hermes-check.sh: the human's 6-hourly Hermes autopilot check, run from the Mac (a Claude session
# or a shell). Pulls the ledger, the alerts file and the last tick's state off the box over rsync,
# lists the fork's PRs with gh (read-only), prints one scorecard, then the three interventions as
# ready-to-paste commands for a brev-shell tmux pane on the box. It modifies nothing on the box
# and exits 0 whatever it finds; the one exception is a refusal to run on the box itself (exit 1).
#
# Usage: ops/nemoclaw-coworkers/hermes-check.sh [LOCAL_DIR]      (default /tmp/hermes-check)
# Env:   BOX (ssh host, default slang-cpu-coworkers), REMOTE (checkout on the box)
set -euo pipefail
case $(hostname) in
  slang-cpu-coworkers*) echo "REFUSING: this is the box ($(hostname)); run hermes-check.sh from the Mac"; exit 1 ;;
esac

OUT=${1:-/tmp/hermes-check}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
BOX=${BOX:-slang-cpu-coworkers}
REMOTE=${REMOTE:-"~/haaggarwal/nemoclaw-coworkers"}
FORK=slang-coworkers/hermes-agent
CHAT_API=http://127.0.0.1:3937/api/chat/send
SSH_CMD="ssh -i ~/.brev/brev.pem -o ConnectTimeout=25 -o BatchMode=yes"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$OUT"

pull() { # <remote path relative to the checkout> <local name>
  if rsync -q -e "$SSH_CMD" "$BOX:$REMOTE/$1" "$OUT/$2" 2>"$OUT/.rsync-$2.err"; then
    echo "  pulled $1"
  else
    echo "  PULL FAILED $1: $(head -c 160 "$OUT/.rsync-$2.err" | tr '\n' ' ')"
    [ -f "$OUT/$2" ] && echo "    (using the copy from a previous pull: $(date -r "$OUT/$2" -u +%Y-%m-%dT%H:%M:%SZ))"
  fi
  return 0
}

echo "== pull from $BOX ($NOW) -> $OUT"
pull groups/orchestrator/reports/ledger.md ledger.md
pull groups/orchestrator/reports/status/alerts.md alerts.md
pull data/shared/hermes/autopilot/state.json state.json
pull data/shared/hermes/autopilot/config.json config.json
pull data/shared/hermes/autopilot/nudges.json nudges.json
pull data/shared/hermes/autopilot/dispatch.log dispatch.log
pull groups/orchestrator/reports/status/autopilot.md autopilot.md

# The a|b|t|r report the last tick rendered (viewer /status/autopilot.md), verbatim and first.
if [ -s "$OUT/autopilot.md" ]; then
  echo
  echo "== a|b|t|r report from the box (pulled copy dated $(date -r "$OUT/autopilot.md" -u +%Y-%m-%dT%H:%M:%SZ))"
  cat "$OUT/autopilot.md"
  echo
else
  echo "  (no autopilot.md on the box yet: the first supervise tick after install writes it)"
fi

echo "== fork PRs ($FORK, read-only)"
if gh pr list --repo "$FORK" --state all --limit 100 \
     --json number,title,url,state,isDraft,headRefName,baseRefName,createdAt,updatedAt,mergedAt,closedAt,headRefOid \
     > "$OUT/prs.json.tmp" 2>"$OUT/.gh.err"; then
  mv "$OUT/prs.json.tmp" "$OUT/prs.json"
  echo "  $(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$OUT/prs.json") PRs"
else
  rm -f "$OUT/prs.json.tmp"
  echo "  gh failed: $(head -c 160 "$OUT/.gh.err" | tr '\n' ' ')"
fi

PLAN=$ROOT/docs/hermes-port/dispatch-plan.md
PLAN_SHA=""
if [ -f "$PLAN" ]; then PLAN_SHA=$(shasum -a 256 "$PLAN" | cut -d' ' -f1); fi

echo
SCORECARD=$HERE/autopilot/scorecard.py
ARGS=(--dir "$OUT" --now "$NOW" --plan "$PLAN")
[ -n "$PLAN_SHA" ] && ARGS+=(--plan-sha256 "$PLAN_SHA")
python3 "$SCORECARD" "${ARGS[@]}" || echo "scorecard failed to render (see above); files are in $OUT"
python3 "$SCORECARD" "${ARGS[@]}" --json > "$OUT/scorecard.json" 2>/dev/null || true
FIRST_ROW=$(python3 -c 'import json,sys
try:
    c=json.load(open(sys.argv[1])); rows=c.get("in_flight") or []; print(rows[0] if rows else "<ID>")
except Exception:
    print("<ID>")' "$OUT/scorecard.json" 2>/dev/null || echo "<ID>")

cat <<EOF

== interventions (paste into a brev-shell tmux pane on the box; every block is hostname-guarded)
GUARD='case \$(hostname) in slang-cpu-coworkers*) ;; *) echo WRONG_HOST=\$(hostname); exit 1;; esac'
CFG=~/haaggarwal/nemoclaw-coworkers/data/shared/hermes/autopilot/config.json

1. Nudge a role on a row's thread (chat API on the box; group = the role's folder; text unmarked):
   eval "\$GUARD"; G=hermes-architect; ID=$FIRST_ROW; TEXT="Supervisor nudge \$ID (human): <state> for <h>h, no <artifact>. Expected next: <artifact> on thread hermes-\$ID. Reply on this thread: status, blocker, ETA."
   curl -sS -X POST $CHAT_API -H 'content-type: application/json' -d "\$(jq -cn --arg g "\$G" --arg t "hermes-\$ID" --arg c "\$TEXT" '{group:\$g, thread_id:\$t, content:\$c}')"; echo

2. Authorize one extra test round for a row (consumed by the next supervise tick; once per row):
   eval "\$GUARD"; ID=$FIRST_ROW; WHY="environmental: <evidence line from the tester's report>"
   jq --arg id "\$ID" --arg why "\$WHY" '.authorize_round = ((.authorize_round // {}) + {(\$id): \$why})' "\$CFG" > "\$CFG.tmp" && mv "\$CFG.tmp" "\$CFG"; cat "\$CFG"

3. Pause a row (freezes its clocks, holds its gate, removes it from nudging) or all dispatch:
   eval "\$GUARD"; ID=$FIRST_ROW
   jq --arg id "\$ID" '.paused_rows = (((.paused_rows // []) + [\$id]) | unique)' "\$CFG" > "\$CFG.tmp" && mv "\$CFG.tmp" "\$CFG"; cat "\$CFG"
   resume:  jq --arg id "\$ID" '.paused_rows = ((.paused_rows // []) - [\$id])' "\$CFG" > "\$CFG.tmp" && mv "\$CFG.tmp" "\$CFG"
   pause all dispatch (supervision continues):  jq '.paused = true' "\$CFG" > "\$CFG.tmp" && mv "\$CFG.tmp" "\$CFG"
   (the dispatch tick is the host cron dispatch-cron.sh, 17 */2 * * *; it reads config.json on every fire)

Dispatch tick (host cron):  crontab -l | grep dispatch-cron; tail -20 ~/haaggarwal/nemoclaw-coworkers/data/shared/hermes/autopilot/dispatch.log
Supervise series:           cd ~/haaggarwal/nemoclaw-coworkers && ./bin/ncl tasks list --group ag-822c9c8a-23e2-4e7a-a6bc-4c071d976392
Last dispatch ticks pulled: $(tail -3 "$OUT/dispatch.log" 2>/dev/null | cut -c1-160 || echo "(no dispatch.log yet)")
Files pulled to $OUT (autopilot.md, ledger.md, alerts.md, state.json, config.json, nudges.json, dispatch.log, prs.json, scorecard.json). Doc: docs/hermes-port/autopilot.md
EOF
exit 0
