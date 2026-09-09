#!/usr/bin/env bash
# dispatch-cron.sh: the Hermes autopilot DISPATCH tick, run from the box's HOST crontab (17 */2 * * *).
#
# Why a host cron and not an Orchestrator task series: an a2a dispatch sent from a task session homes
# the architect's replies, the [Spec handoff], the test reports and the review verdicts in the task's
# system session, not in the per-row dashboard thread hermes-<ID> where the operator and the status
# page read the chain. This script instead POSTs each dispatch to the dashboard chat API on thread
# hermes-<ID>, exactly as the hand path ops/nemoclaw-coworkers/dispatch-rows.sh does; the Orchestrator
# handles that inbound in the row's own thread (adds the ledger row, dispatches the architect). The
# supervise tick stays an Orchestrator series (install.sh).
#
# Per fire: runs hermes_queue.py on host paths (plan + matrix under data/shared/hermes/, the ledger at
# groups/orchestrator/reports/ledger.md, config + bookkeeping under data/shared/hermes/autopilot/), with
# the previous state.json, the `dispatched` entries in nudges.json and any architect or orchestrator
# session already on a hermes-<ID> thread overlaid as prior state (never dispatch twice, autopilot.md
# §8); honours config.paused and every other dispatch_paused reason; raises the queue's alerts into
# alerts.md through record.py (one per (row, kind) per 24 h); then, for at most wip.free rows in
# eligible_next order, re-checks the ledger, POSTs {group, thread_id, content: orchestrator_text} and
# on HTTP 200 records `record.py dispatched`, so the next tick counts the row as in flight. A POST that
# is not HTTP 200 stops the tick: nothing is recorded for that row, and an unreachable API dispatches
# nothing. The ledger row the Orchestrator then writes is the second guard against a repeat.
#
# Writes: data/shared/hermes/autopilot/{dispatch.log, dispatch-state.json, nudges.json, raw/dispatch-*}
# and groups/orchestrator/reports/status/alerts.md (via record.py). Never edits the ledger, the plan,
# the matrix or state.json (the supervise tick's). Exit 0 on "nothing to do"; exit 1 on a missing input,
# a broken core or a failed POST (the cron log says which). --dry-run prints the POST bodies and the
# alert lines and writes nothing.
#
# Usage: dispatch-cron.sh [--dry-run]
# Env:   ROOT (the checkout; default ~/haaggarwal/nemoclaw-coworkers), API (default the dashboard's
#        loopback chat API), NCL (default $ROOT/bin/ncl; the sessions overlay is skipped with a log
#        line when it is missing or fails), DISPATCH_GROUP (default orchestrator), SLEEP_BETWEEN (2),
#        NOW_OVERRIDE (tests).
set -euo pipefail
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac

DRY_RUN=0
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "dispatch-cron: unknown argument $arg (only --dry-run)"; exit 2 ;;
  esac
done

ROOT=${ROOT:-$HOME/haaggarwal/nemoclaw-coworkers}
API=${API:-http://127.0.0.1:3937/api/chat/send}
GROUP=${DISPATCH_GROUP:-orchestrator}
NCL=${NCL:-$ROOT/bin/ncl}
SLEEP_BETWEEN=${SLEEP_BETWEEN:-2}
AP=$ROOT/data/shared/hermes/autopilot
PLAN=$ROOT/data/shared/hermes/dispatch-plan.md
MATRIX=$ROOT/data/shared/hermes/gap-matrix.md
LEDGER=$ROOT/groups/orchestrator/reports/ledger.md
ALERTS=$ROOT/groups/orchestrator/reports/status/alerts.md
LOG=$AP/dispatch.log
NOW=${NOW_OVERRIDE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# The per-row re-check right before a POST: the id as a whole token anywhere in the row-id cell (bare,
# bold, bracketed, followed by a note); OPS-F58 must not match OPS-F58.a. <ID> is substituted per row,
# dots escaped. test_hermes_queue.py (PromptRecheck) pins the spellings.
LEDGER_ROW_RE='^\|([^|]*[^A-Za-z0-9|])?<ID>([^.A-Za-z0-9]|$)'

say() { echo "dispatch-cron $NOW: $*"; }
note() { # one line per action into dispatch.log (stdout too; nothing is written under --dry-run)
  say "$*"
  [ "$DRY_RUN" = 1 ] || echo "$NOW $*" >> "$LOG"
}
ledger_has_row() { # <ID>
  local id=${1//./\\.}
  grep -q -E "${LEDGER_ROW_RE//<ID>/$id}" "$LEDGER"
}
find_core() { # <script name> -> path or empty (next to this script, the mirror, the checkout)
  local d
  for d in "$HERE" "$AP" "$ROOT/ops/nemoclaw-coworkers/autopilot"; do
    if [ -f "$d/$1" ]; then echo "$d/$1"; return 0; fi
  done
  echo ""
}
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN=timeout
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN=gtimeout
else TIMEOUT_BIN=""; fi
with_timeout() { # <seconds> <cmd...>
  local secs=$1; shift
  if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$secs" "$@"; else "$@"; fi
}

# --- 0. Inputs, core, lock ---------------------------------------------------------------------
[ -d "$ROOT" ] || { say "ROOT $ROOT is not a directory"; exit 1; }
QUEUE=$(find_core hermes_queue.py)
RECORD=$(find_core record.py)
if [ -z "$QUEUE" ] || [ -z "$RECORD" ]; then
  say "core missing (hermes_queue.py or record.py) next to $HERE, in $AP or the checkout; run install.sh"
  exit 1
fi
for pair in "plan:$PLAN" "matrix:$MATRIX" "ledger:$LEDGER"; do
  if [ ! -s "${pair#*:}" ]; then
    say "${pair%%:*} missing or empty: ${pair#*:}; a queue built on a missing source is a guess, dispatching nothing"
    exit 1
  fi
done
if [ "$DRY_RUN" = 1 ]; then
  RAW=$(mktemp -d "${TMPDIR:-/tmp}/dispatch-cron-dry.XXXXXX")
  trap 'rm -rf "$RAW"' EXIT
else
  RAW=$AP/raw
  mkdir -p "$AP" "$RAW"
  LOCK=$AP/.dispatch-cron.lock
  if ! mkdir "$LOCK" 2>/dev/null; then
    # A lock older than 30 min is a killed run; anything younger is a live one.
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
      rm -rf "$LOCK" && mkdir "$LOCK"
    else
      say "another run holds $LOCK; exiting"
      exit 0
    fi
  fi
  trap 'rm -rf "$LOCK"' EXIT
fi

# --- 1. Sessions overlay (optional): a hand dispatch between ticks is a session on hermes-<ID> ------
SESSIONS_OK=0
if [ -x "$NCL" ]; then
  if with_timeout 25 "$NCL" groups list --json > "$RAW/dispatch-groups.json" 2>"$RAW/dispatch-ncl.err" \
     && with_timeout 25 "$NCL" sessions list --limit 2000 --json > "$RAW/dispatch-sessions.json" 2>>"$RAW/dispatch-ncl.err"; then
    SESSIONS_OK=1
  else
    say "sessions overlay unavailable ($NCL failed: $(head -c 160 "$RAW/dispatch-ncl.err" | tr '\n' ' ')); relying on the ledger and nudges.json"
  fi
else
  say "sessions overlay skipped ($NCL not executable); relying on the ledger and nudges.json"
fi

# --- 2. Prior state for the queue: previous state.json + dispatched overlays (as pull-state.sh does) ---
AP="$AP" RAW="$RAW" SESSIONS_OK="$SESSIONS_OK" python3 - <<'PY'
import json, os, re
from datetime import datetime, timezone

ap, raw = os.environ["AP"], os.environ["RAW"]
ROW_ID = r"[A-Z0-9]+-F[0-9]+(?:\.[a-z])?"
THREAD_RE = re.compile(rf"^hermes-({ROW_ID})$")
DISPATCHERS = ("hermes-architect", "orchestrator")

def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return v if isinstance(v, type(default)) else default
    except (OSError, ValueError):
        return default

def read_data(path):
    v = read_json(path, {})
    if isinstance(v, dict):
        v = v.get("data") if v.get("ok") is not False else None
    if not isinstance(v, list):
        v = read_json(path, [])
    return v if isinstance(v, list) else []

def iso_z(value):
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    v = re.sub(r"(\.\d{3})\d+", r"\1", v)
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

prev = read_json(os.path.join(ap, "state.json"), {})
nudges = read_json(os.path.join(ap, "nudges.json"), {})
prior = {"rows": dict(prev.get("rows") or {}), "signals": prev.get("signals") or {}}

def mark_dispatched(rid, at, by):
    row = dict(prior["rows"].get(rid) or {})
    if not row.get("dispatched_at") or at < row["dispatched_at"]:
        row["dispatched_at"] = at
        row["dispatched_by"] = by
    prior["rows"][rid] = row

for d in nudges.get("dispatched") or []:
    rid, at = d.get("row"), iso_z(d.get("at"))
    if rid and at:
        mark_dispatched(rid, at, "record.py")

if os.environ["SESSIONS_OK"] == "1":
    groups = read_data(os.path.join(raw, "dispatch-groups.json"))
    sessions = read_data(os.path.join(raw, "dispatch-sessions.json"))
    dispatch_groups = {g.get("id") for g in groups
                       if (g.get("folder") or "").strip() in DISPATCHERS or (g.get("name") or "").strip() in DISPATCHERS}
    for s in sessions:
        if s.get("agent_group_id") not in dispatch_groups:
            continue
        m = THREAD_RE.match(s.get("thread_id") or "")
        if not m:
            continue
        at = iso_z(s.get("created_at")) or iso_z(s.get("last_active"))
        if at:
            mark_dispatched(m.group(1), at, f"session {s.get('id')} on thread {s.get('thread_id')}")

with open(os.path.join(raw, "dispatch-prior.json"), "w", encoding="utf-8") as fh:
    json.dump(prior, fh)
PY

# --- 3. The queue ------------------------------------------------------------------------------
if ! python3 "$QUEUE" --plan "$PLAN" --matrix "$MATRIX" --ledger "$LEDGER" --config "$AP/config.json" \
     --state "$RAW/dispatch-prior.json" --now "$NOW" > "$RAW/dispatch-queue.json" 2> "$RAW/dispatch-queue.err"; then
  say "hermes_queue.py failed: $(head -c 300 "$RAW/dispatch-queue.err" | tr '\n' ' '); dispatching nothing"
  exit 1
fi
if [ "$DRY_RUN" != 1 ]; then
  cp "$RAW/dispatch-queue.json" "$AP/.dispatch-state.json.tmp" && mv "$AP/.dispatch-state.json.tmp" "$AP/dispatch-state.json"
fi

# --- 4. What this tick does: fresh alerts (TSV) + the rows to POST (TSV + one body file each) -----
if ! RAW="$RAW" AP="$AP" NOW="$NOW" GROUP="$GROUP" python3 - > "$RAW/dispatch-plan.env" <<'PY'
import json, os, shlex
from datetime import datetime, timedelta, timezone

raw, ap, now, group = os.environ["RAW"], os.environ["AP"], os.environ["NOW"], os.environ["GROUP"]
st = json.load(open(os.path.join(raw, "dispatch-queue.json"), encoding="utf-8"))
try:
    book = json.load(open(os.path.join(ap, "nudges.json"), encoding="utf-8"))
except (OSError, ValueError):
    book = {}
if not isinstance(book, dict):
    book = {}

def clean(s):
    return " ".join(str(s or "").split())

# alerts not yet raised for the same (row, kind) in 24 h; the line is the dispatch-tick format
now_dt = datetime.strptime(now, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
cutoff = (now_dt - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
raised = {(a.get("row") or "plan", a.get("reason")) for a in (book.get("alerts") or [])
          if isinstance(a, dict) and (a.get("at") or "") >= cutoff}
DECISION = {
    "plan-changed": "re-pin plan_sha256 / matrix_sha256 in config.json (dispatch is paused meanwhile)",
    "ledger-id-spelling": "fix the ledger row: make the row-id cell the bare id (the row is already counted)",
    "ledger-duplicate": "remove the duplicate ledger row (the last one is used)",
    "ledger-unknown-id": "fix or remove the ledger row (the id is not in the matrix)",
    "ledger-unreadable": "restore the ledger header row (dispatch is paused meanwhile)",
    "plan-violation": "keep the row and change the plan, or stop the row",
    "podman-box-needed": "set podman_box: true in config.json when the podman box is ready",
    "ledger-drift": "reconcile the ledger with the fork",
}
with open(os.path.join(raw, "dispatch-alerts.tsv"), "w", encoding="utf-8") as fh:
    n_alerts = 0
    for a in st.get("alerts") or []:
        if not isinstance(a, dict) or not a.get("kind"):
            continue
        row = a.get("row") or "plan"
        key = a.get("alert_key") or a["kind"]
        if (row, key) in raised:
            continue
        raised.add((row, key))
        line = (f"- {now} · {row} · {a['kind']} · {clean(a.get('detail'))} · decision: "
                f"{DECISION.get(a['kind'], 'see autopilot.md §3')} · thread hermes-{row if row != 'plan' else 'status'}")
        fh.write(f"{row}\t{key}\t{line}\n")
        n_alerts += 1

wip = st.get("wip") if isinstance(st.get("wip"), dict) else {}
free = int(wip.get("free") or 0)
rows = [e for e in (st.get("eligible_next") or []) if isinstance(e, dict) and e.get("id")][:free]
with open(os.path.join(raw, "dispatch-rows.tsv"), "w", encoding="utf-8") as fh:
    for e in rows:
        thread = e.get("thread_id") or f"hermes-{e['id']}"
        content = e.get("orchestrator_text") or e.get("dispatch_text") or ""
        body = {"group": group, "thread_id": thread, "content": content}
        with open(os.path.join(raw, f"dispatch-body-{e['id']}.json"), "w", encoding="utf-8") as bf:
            json.dump(body, bf, ensure_ascii=False)
        fh.write(f"{e['id']}\t{clean(e.get('batch')) or '?'}\t{thread}\n")

print("PAUSED=" + shlex.quote(str(st.get("dispatch_paused") or "")))
print("FREE=" + shlex.quote(str(free)))
print("IN_FLIGHT=" + shlex.quote(str(wip.get("in_flight", "?"))))
print("LIMIT=" + shlex.quote(str(wip.get("limit", "?"))))
print("N_ALERTS=" + shlex.quote(str(n_alerts)))
print("N_ROWS=" + shlex.quote(str(len(rows))))
print("ELIGIBLE=" + shlex.quote(",".join(e["id"] for e in rows) or "-"))
PY
then
  say "could not read the queue output ($RAW/dispatch-queue.json); dispatching nothing"
  exit 1
fi
# shellcheck disable=SC1091
. "$RAW/dispatch-plan.env"

# --- 5. Alerts first: the one output a paused or quiet tick may still produce -------------------
while IFS=$'\t' read -r ROW REASON LINE; do
  [ -n "$ROW" ] || continue
  if [ "$DRY_RUN" = 1 ]; then
    say "DRY-RUN alert $ROW $REASON: $LINE"
    continue
  fi
  python3 "$RECORD" alerted --row "$ROW" --reason "$REASON" --line "$LINE" \
    --file "$AP/nudges.json" --alerts-md "$ALERTS" --now "$NOW" >/dev/null
  note "alerted $ROW $REASON"
done < "$RAW/dispatch-alerts.tsv"

# --- 6. Nothing to do? -------------------------------------------------------------------------------
if [ -n "$PAUSED" ]; then
  say "dispatch paused ($PAUSED); in flight $IN_FLIGHT/$LIMIT; alerts raised $N_ALERTS"
  exit 0
fi
if [ "$N_ROWS" -eq 0 ]; then
  say "nothing to do (in flight $IN_FLIGHT/$LIMIT, free $FREE, eligible none; alerts raised $N_ALERTS)"
  exit 0
fi

# --- 7. Dispatch, one row at a time, in eligible_next order, at most wip.free rows ----------------
DISPATCHED=0
while IFS=$'\t' read -r ID BATCH THREAD; do
  [ -n "$ID" ] || continue
  if ledger_has_row "$ID"; then
    note "skip $ID: a ledger row appeared since the queue ran (hand dispatch); not counted, not sent"
    continue
  fi
  BODY=$RAW/dispatch-body-$ID.json
  if [ "$DRY_RUN" = 1 ]; then
    echo "DRY-RUN POST $API"
    cat "$BODY"; echo
    continue
  fi
  OUT=$RAW/dispatch-response-$ID.txt
  ERR=$RAW/dispatch-curl-$ID.err
  CODE=$(curl -sS -m 15 -o "$OUT" -w '%{http_code}' -X POST "$API" -H 'content-type: application/json' \
           --data-binary "@$BODY" 2>"$ERR") || CODE=000
  if [ "$CODE" != 200 ]; then
    note "STOP $ID: POST $API returned HTTP $CODE ($(cat "$ERR" "$OUT" 2>/dev/null | head -c 200 | tr '\n' ' ')); nothing recorded, the remaining rows wait for the next tick"
    exit 1
  fi
  python3 "$RECORD" dispatched --row "$ID" --batch "$BATCH" --file "$AP/nudges.json" --now "$NOW" >/dev/null
  note "dispatched $ID batch $BATCH thread $THREAD http 200"
  DISPATCHED=$((DISPATCHED + 1))
  [ "$SLEEP_BETWEEN" = 0 ] || sleep "$SLEEP_BETWEEN"
done < "$RAW/dispatch-rows.tsv"

say "done: dispatched $DISPATCHED of $N_ROWS ($ELIGIBLE); in flight was $IN_FLIGHT/$LIMIT; alerts raised $N_ALERTS"
exit 0
