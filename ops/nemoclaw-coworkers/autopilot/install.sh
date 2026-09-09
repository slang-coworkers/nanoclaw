#!/usr/bin/env bash
# install.sh: install or refresh the Hermes autopilot on the nemoclaw-coworkers box. Idempotent.
#
# 1. Mirrors this directory (core + collector + record + scorecard + the supervise gate and prompt +
#    dispatch-cron.sh) into data/shared/hermes/autopilot/, which the Orchestrator container mounts at
#    /workspace/shared/hermes/autopilot/ and the host cron runs from. config.json is copied only when
#    absent: the human edits the live copy (wip, paused, paused_rows, authorize_round, plan_sha256)
#    and a reinstall must not reset it. Tests are not mirrored.
# 2. Creates or updates the supervise series (hermes-ap-supervise, 47 */2 * * *) with its --script
#    gate (12 fires/day is above the ungated MAX_DAILY_FIRES = 4; the gate is what makes a quiet tick
#    free) and the prompt file's content. An existing series is found by its name slug
#    (hermes-ap-supervise-<hex>) and updated in place, so running this twice never yields two series.
# 3. Installs the dispatch tick as ONE host crontab line (17 */2 * * *, dispatch-cron.sh), replacing
#    any line that mentions dispatch-cron.sh. The dispatch tick is not a task series: a dispatch sent
#    from a task session homes the chain's replies in that session instead of the row's dashboard
#    thread hermes-<ID>. A hermes-ap-dispatch series left over from that design is cancelled.
#
# Run on the box after deploy.sh (which mirrors the same directory) whenever a prompt, gate or the
# cron script changed; nothing else needs a host restart. deploy.sh touches neither the series nor
# the crontab.
set -euo pipefail
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac
cd ~/haaggarwal/nemoclaw-coworkers
ROOT=$PWD

GROUP=${GROUP:-ag-822c9c8a-23e2-4e7a-a6bc-4c071d976392}   # the Orchestrator agent group on this box
SRC=ops/nemoclaw-coworkers/autopilot
DST=data/shared/hermes/autopilot
NCL=./bin/ncl

[ -d "$SRC" ] || { echo "missing $SRC: merge nv-hermes (deploy.sh) first"; exit 1; }
for f in hermes_queue.py hermes_supervise.py collect_threads.py record.py scorecard.py abtr.py pull-state.sh \
         gate-supervise.sh supervise-tick.md dispatch-cron.sh config.json; do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f"; exit 1; }
done

echo "== mirror $SRC -> $DST (config.json only when absent)"
mkdir -p "$DST"
for f in "$SRC"/*.py "$SRC"/*.sh "$SRC"/*.md; do
  case $(basename "$f") in test_*) continue ;; esac
  if [ -f "$f" ]; then cp "$f" "$DST/"; fi
done
if [ -f "$DST/config.json" ]; then
  echo "  keeping live $DST/config.json: $(tr -d '\n' < "$DST/config.json" | head -c 200)"
else
  cp "$SRC/config.json" "$DST/"
  echo "  installed default config.json"
fi
bash -n "$DST/pull-state.sh" "$DST/gate-supervise.sh" "$DST/dispatch-cron.sh"
chmod +x "$DST/dispatch-cron.sh"   # cron runs it directly
# Retired files from the task-series design: a stale mirror copy must not look live.
rm -f "$DST/gate-dispatch.sh" "$DST/dispatch-tick.md"
ls -1 "$DST"

find_series() { # <slug> -> the live series id for that name, or empty
  "$NCL" tasks list --group "$GROUP" --json | python3 -c '
import json, re, sys
slug = sys.argv[1]
rows = json.load(sys.stdin).get("data") or []
ids = sorted(r.get("series_id", "") for r in rows if re.fullmatch(slug + r"-[0-9a-f]{4}", r.get("series_id", "")))
print(ids[0] if ids else "")
if len(ids) > 1:
    sys.stderr.write("WARNING: several live series match %s: %s (updating the first; cancel the others)\n" % (slug, ids))
' "$1"
}

ensure_series() { # <name> <cron> <prompt-file> <gate-file>
  local name=$1 cron=$2 prompt=$3 gate=$4 id
  id=$(find_series "$name")
  if [ -n "$id" ]; then
    echo "== update $id: $cron, prompt $(wc -c < "$prompt") bytes, gate $(wc -c < "$gate") bytes"
    if ! "$NCL" tasks update --id "$id" --group "$GROUP" --recurrence "$cron" \
         --prompt "$(cat "$prompt")" --script "$(cat "$gate")" --json >/dev/null; then
      echo "   update refused; try: $NCL tasks pause $id && <rerun install.sh> && $NCL tasks resume $id"
      return 1
    fi
  else
    echo "== create $name: $cron"
    id=$("$NCL" tasks create --group "$GROUP" --name "$name" --recurrence "$cron" \
          --prompt "$(cat "$prompt")" --script "$(cat "$gate")" --json \
        | python3 -c 'import json, sys; print(json.load(sys.stdin)["data"]["series_id"])')
  fi
  echo "$name = $id"
}

OLD_DISPATCH=$(find_series hermes-ap-dispatch)
if [ -n "$OLD_DISPATCH" ]; then
  echo "== retiring series $OLD_DISPATCH (hermes-ap-dispatch): the dispatch tick is the host cron below, not a task."
  echo "   Reason: a dispatch sent from a task session homes the architect's replies, the [Spec handoff], the test"
  echo "   reports and the review verdicts in the task's system session, not in the row's dashboard thread hermes-<ID>."
  if "$NCL" tasks cancel --id "$OLD_DISPATCH" --group "$GROUP" --json >/dev/null; then
    echo "   cancelled $OLD_DISPATCH"
  else
    echo "   cancel refused; pause it by hand: $NCL tasks pause --id $OLD_DISPATCH --group $GROUP"
  fi
fi

ensure_series hermes-ap-supervise "47 */2 * * *" "$SRC/supervise-tick.md" "$SRC/gate-supervise.sh"

echo "== dispatch tick: host crontab line (replaces any existing dispatch-cron.sh line)"
CRON_SH=$ROOT/$DST/dispatch-cron.sh
CRON_LINE="17 */2 * * * $CRON_SH >> $ROOT/$DST/dispatch-cron.log 2>&1"
CRON_TMP=$(mktemp)
{ crontab -l 2>/dev/null || true; } | { grep -v -F 'dispatch-cron.sh' || true; } > "$CRON_TMP"
echo "$CRON_LINE" >> "$CRON_TMP"
crontab "$CRON_TMP"
rm -f "$CRON_TMP"
crontab -l | grep -F 'dispatch-cron.sh'
"$CRON_SH" --dry-run | head -5 || echo "   dry run failed; check $ROOT/$DST inputs before the first fire"

echo "== series on the Orchestrator group"
"$NCL" tasks list --group "$GROUP"
echo "== pause dispatch: set paused=true in $DST/config.json (or remove the crontab line); pause supervision: $NCL tasks pause --id <id> --group $GROUP"
echo "== dispatch log: $DST/dispatch.log (one line per action); cron output: $DST/dispatch-cron.log"
