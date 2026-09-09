#!/usr/bin/env bash
# pull-state.sh: assemble the Hermes autopilot state INSIDE the Orchestrator container.
#
# Called by the two tick prompts, and by the task gates under `timeout 22`. It reads the one
# ledger, the plan and the matrix from the shared mirror, the fork through `gh` (OneCLI injects
# the credential), and the role sessions through `ncl` (the dashboard API is not reachable from
# a container), then runs the deterministic core and writes, under $AUTOPILOT_DIR:
#   threads.json   per-row session transcripts + cost status   (collect_threads.py)
#   prs.json       gh pr list --state all, raw
#   state.json     the merged result the prompts act on
# A source that is unavailable is written as what we have plus a "collector_errors" entry that
# names the probe; the script still exits 0. It never fails silently, and it never modifies the
# ledger, the plan, the matrix or the fork. The only files it creates besides its outputs are
# config.json (defaults, when absent), nudges.json (empty bookkeeping, when absent) and the
# alerts.md header (when absent). Intermediate files live under $AUTOPILOT_DIR/raw/.
#
# Order, and why: the queue runs BEFORE the collector. The queue needs only the ledger, the plan,
# the matrix, config.json and the previous state, and its `in_flight` list is what tells the
# collector which row threads are worth a transcript read (COLLECT_ROWS_FROM_QUEUE). Sessions on
# other row threads are listed but not read, so the never-dispatch-twice check still sees them.
#
# Core (stdlib Python next to this file, mirrored with it):
#   hermes_queue.py     --plan --matrix --ledger --config --state <prior state.json> --now
#                       -> wip {limit,in_flight,free}, in_flight, eligible_next [{id, batch,
#                          disposition, dispatch_text, thread_id, ...}], rows, gating, alerts
#   collect_threads.py  --groups --sessions --ncl --rows <in_flight> --deadline-s --now
#                       -> threads.json (sessions per row thread, transcripts, cost status)
#   hermes_supervise.py --state <queue output> --threads --prs --nudges --sessions --config --now
#                       -> rows {ID: {stage, clock_start, age_hours, slo_status, hold, cost_hold, ...}},
#                          actions [{kind: hold|gate|nudge|alert, row, ...}], alerts, summary
#
# Three adaptations happen in between (autopilot.md §8):
#   * prior-state.json: the previous state.json plus two dispatch overlays the ledger may not show
#     yet, `dispatched` entries from nudges.json (record.py) and any hermes-architect / orchestrator
#     session already sitting on a `hermes-<ID>` thread (a hand dispatch between ticks). Either one
#     makes the row `dispatched` for the queue, so it is counted in WIP and never dispatched again.
#   * threads-flat.json: one list per thread. A thread with ANY session whose transcript was not
#     read (ncl failure, deadline, not in flight) is written as null, so the supervisor takes no
#     action on partial evidence ("degrade, never guess").
#   * nudge-book.json: per-row last nudge / state / count / alert times from nudges.json.
#
# state.json = the queue output, plus: supervise (the supervisor's full output), actions, alerts
# (queue + supervisor), summary, signals (tester_pass / merged / not_merged for the next queue run),
# config, paused, sources (checked flags + sha256 per input, fork, sessions, core status),
# ledger_rows (a header-located ledger read independent of the core), collector_errors, generated_at.
#
# Env knobs (container defaults shown): AUTOPILOT_DIR LEDGER PLAN MATRIX ALERTS FORK NCL GH
# PROBE_TIMEOUT=25 COLLECT_LIMIT=200 COLLECT_MAX_SESSIONS=80 COLLECT_DEADLINE_S=0 (the gates set 10)
# COLLECT_ROWS_FROM_QUEUE=1 (0 reads every row thread) NOW_OVERRIDE. Every path has an override so
# the script runs offline against fixtures with a fake `ncl` and `gh` on PATH (test_pull_state.py).
set -euo pipefail

AP=${AUTOPILOT_DIR:-/workspace/shared/hermes/autopilot}
LEDGER=${LEDGER:-/workspace/agent/reports/ledger.md}
PLAN=${PLAN:-/workspace/shared/hermes/dispatch-plan.md}
MATRIX=${MATRIX:-/workspace/shared/hermes/gap-matrix.md}
ALERTS=${ALERTS:-/workspace/agent/reports/status/alerts.md}
FORK=${FORK:-slang-coworkers/hermes-agent}
NCL=${NCL:-ncl}
GH=${GH:-gh}
PROBE_TIMEOUT=${PROBE_TIMEOUT:-25}
COLLECT_LIMIT=${COLLECT_LIMIT:-200}
COLLECT_MAX_SESSIONS=${COLLECT_MAX_SESSIONS:-80}
COLLECT_DEADLINE_S=${COLLECT_DEADLINE_S:-0}
COLLECT_ROWS_FROM_QUEUE=${COLLECT_ROWS_FROM_QUEUE:-1}
NOW=${NOW_OVERRIDE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RAW=$AP/raw

mkdir -p "$AP" "$RAW" "$(dirname "$ALERTS")"
ERRORS=$RAW/errors.jsonl
: > "$ERRORS"

# coreutils `timeout` is in the container image; a Mac running the offline test has gtimeout or nothing.
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN=timeout
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN=gtimeout
else TIMEOUT_BIN=""; fi
with_timeout() { # <seconds> <cmd...>
  local secs=$1; shift
  if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$secs" "$@"; else "$@"; fi
}

log() { echo "pull-state: $*" >&2; }
record_error() { # <source> <message>
  python3 -c 'import json,sys; print(json.dumps({"source": sys.argv[1], "error": sys.argv[2][:400]}))' "$1" "$2" >> "$ERRORS"
  log "ERROR $1: ${2:0:200}"
}
# run_probe <source> <outfile> <cmd...>: stdout to <outfile> on success; a failure is recorded, never fatal.
run_probe() {
  local src=$1 out=$2 tmp err rc=0
  shift 2
  tmp="$out.tmp"
  err=$("$@" 2>&1 >"$tmp") || rc=$?
  if [ "$rc" -eq 0 ]; then mv "$tmp" "$out"; return 0; fi
  rm -f "$tmp"
  record_error "$src" "exit $rc: ${err:-no stderr}"
  return 0
}
find_core() { # <script name> -> path or empty
  for d in "$HERE" "$AP"; do
    if [ -f "$d/$1" ]; then echo "$d/$1"; return 0; fi
  done
  echo ""
}

# --- 0. Files this script owns when absent -----------------------------------------------
[ -f "$AP/config.json" ] || printf '{\n  "wip": 3,\n  "paused": false\n}\n' > "$AP/config.json"
[ -f "$AP/nudges.json" ] || printf '{"nudges": [], "alerts": [], "dispatched": [], "redispatched": [], "round3": []}\n' > "$AP/nudges.json"
if [ ! -s "$ALERTS" ]; then
  printf '# Hermes autopilot alerts (newest first)\n\nAppended by the supervise tick; the human'"'"'s 6-hourly check reads it. Lines are never edited or removed.\n\n' > "$ALERTS"
fi

# --- 1. Inputs that must exist (recorded, not fatal) ---------------------------------------
for pair in "ledger:$LEDGER" "plan:$PLAN" "matrix:$MATRIX"; do
  name=${pair%%:*}; path=${pair#*:}
  [ -s "$path" ] || record_error "$name" "missing or empty: $path"
done

# --- 2. The fork: one gh call ------------------------------------------------------------
FORK_CHECKED=false
run_probe "gh pr list" "$RAW/prs.json" with_timeout "$PROBE_TIMEOUT" "$GH" pr list --repo "$FORK" --state all --limit 100 \
  --json number,title,url,body,headRefName,baseRefName,isDraft,state,createdAt,updatedAt,mergedAt,closedAt,headRefOid,mergeCommit,comments
if [ -s "$RAW/prs.json" ] && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$RAW/prs.json" 2>/dev/null; then
  mv "$RAW/prs.json" "$AP/prs.json"
  FORK_CHECKED=true
elif [ -f "$RAW/prs.json" ]; then
  record_error "gh pr list" "output is not JSON"
  rm -f "$RAW/prs.json"
fi
[ -f "$AP/prs.json" ] || echo '[]' > "$AP/prs.json"

# --- 3. Sessions: groups + the session list (the transcripts come after the queue) ---------
run_probe "ncl groups list" "$RAW/groups.json" with_timeout "$PROBE_TIMEOUT" "$NCL" groups list --json
run_probe "ncl sessions list" "$RAW/sessions.json" with_timeout "$PROBE_TIMEOUT" "$NCL" sessions list --limit 2000 --json

# --- 4. Bookkeeping -> the queue's prior state and the supervisor's nudge book -------------
#   raw/prior-state.json  previous state.json + dispatched_at overlays (nudges.json, thread sessions)
#   raw/nudge-book.json   {"<ID>": {last_nudge, state, count, alerts: {alert_key: ISO}}}
AP="$AP" RAW="$RAW" NOW="$NOW" ERRORS="$ERRORS" python3 - <<'PY'
import json, os, re
from datetime import datetime, timezone

ap, raw = os.environ["AP"], os.environ["RAW"]
errors = []
ROW_ID = r"[A-Z0-9]+-F[0-9]+(?:\.[a-z])?"
THREAD_RE = re.compile(rf"^hermes-({ROW_ID})$")
DISPATCHERS = ("hermes-architect", "orchestrator")

def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return v if isinstance(v, type(default)) else default
    except FileNotFoundError:
        return default
    except (OSError, ValueError) as exc:
        errors.append({"source": os.path.basename(path), "error": f"unreadable JSON: {exc}"})
        return default

def read_data(path):
    """An `ncl --json` frame or a bare list; [] when absent or unreadable (already recorded upstream)."""
    v = read_json(path, {})
    if isinstance(v, dict):
        v = v.get("data") if v.get("ok") is not False else None
    if not isinstance(v, list):
        v = read_json(path, [])
    return v if isinstance(v, list) else []

def write_json(name, obj):
    with open(os.path.join(raw, name), "w", encoding="utf-8") as fh:
        json.dump(obj, fh)

def iso_z(value):
    """ncl timestamps: inbound ISO 8601, outbound SQL `YYYY-MM-DD HH:MM:SS` (UTC). One shape out."""
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

# prior state for the queue: keep rows/signals, overlay dispatch bookkeeping the ledger may not show yet
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

# A hand dispatch between ticks: an architect or orchestrator session already on the row thread.
groups = read_data(os.path.join(raw, "groups.json"))
sessions = read_data(os.path.join(raw, "sessions.json"))
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
write_json("prior-state.json", prior)

book = {}
for n in sorted(nudges.get("nudges") or [], key=lambda x: x.get("at") or ""):
    rid = n.get("row")
    if not rid:
        continue
    b = book.setdefault(rid, {"last_nudge": None, "state": None, "count": 0, "alerts": {}})
    b["count"] += 1
    if n.get("at") and (b["last_nudge"] is None or n["at"] > b["last_nudge"]):
        b["last_nudge"], b["state"] = n["at"], n.get("state")
for a in nudges.get("alerts") or []:
    rid, key, at = a.get("row"), a.get("reason") or "alert", a.get("at")
    if not rid or not at:
        continue
    b = book.setdefault(rid, {"last_nudge": None, "state": None, "count": 0, "alerts": {}})
    if at > (b["alerts"].get(key) or ""):
        b["alerts"][key] = at
write_json("nudge-book.json", book)

with open(os.environ["ERRORS"], "a", encoding="utf-8") as fh:
    for e in errors:
        fh.write(json.dumps(e) + "\n")
PY

# --- 5. The queue -----------------------------------------------------------------------------
CORE_QUEUE=missing
Q=$(find_core hermes_queue.py)
if [ -z "$Q" ]; then
  record_error "hermes_queue.py" "not found next to pull-state.sh or in $AP (core not mirrored)"
elif [ ! -s "$PLAN" ] || [ ! -s "$MATRIX" ]; then
  CORE_QUEUE=skipped
  record_error "hermes_queue.py" "skipped: plan or matrix missing"
elif python3 "$Q" --plan "$PLAN" --matrix "$MATRIX" --ledger "$LEDGER" --config "$AP/config.json" \
       --state "$RAW/prior-state.json" --now "$NOW" > "$RAW/queue.json" 2> "$RAW/queue.err"; then
  CORE_QUEUE=ok
else
  CORE_QUEUE=failed
  record_error "hermes_queue.py" "exit non-zero: $(head -c 300 "$RAW/queue.err")"
fi
[ "$CORE_QUEUE" = ok ] || echo '{}' > "$RAW/queue.json"

# --- 6. Transcripts for the in-flight rows via collect_threads.py, then the flat views ---------
#   raw/threads-flat.json         {"hermes-<ID>": [{ts, direction, text, sender, role}] | null}
#   raw/sessions-by-thread.json   {"hermes-<ID>": [{role, session_id, cost_status, container_status}]}
ROWS_ARGS=()
if [ "$COLLECT_ROWS_FROM_QUEUE" = 1 ] && [ "$CORE_QUEUE" = ok ]; then
  IN_FLIGHT=$(python3 -c 'import json,sys; st=json.load(open(sys.argv[1])); print(",".join(st.get("in_flight") or []))' "$RAW/queue.json" 2>/dev/null || echo "")
  ROWS_ARGS=(--rows "$IN_FLIGHT")
fi
COLLECT=$(find_core collect_threads.py)
if [ -n "$COLLECT" ]; then
  run_probe "collect_threads.py" "$RAW/threads.json" python3 "$COLLECT" \
    --groups "$RAW/groups.json" --sessions "$RAW/sessions.json" --ncl "$NCL" --now "$NOW" \
    --limit "$COLLECT_LIMIT" --max-sessions "$COLLECT_MAX_SESSIONS" --deadline-s "$COLLECT_DEADLINE_S" "${ROWS_ARGS[@]}"
else
  record_error "collect_threads.py" "not found next to pull-state.sh or in $AP"
fi
if [ -s "$RAW/threads.json" ]; then
  mv "$RAW/threads.json" "$AP/threads.json"
else
  printf '{"generated_at": "%s", "roles": {}, "threads": {}, "other_threads": [], "sessions_checked": false, "counts": {}, "collector_errors": []}\n' "$NOW" > "$AP/threads.json"
fi

AP="$AP" RAW="$RAW" ERRORS="$ERRORS" python3 - <<'PY'
import json, os, re
from datetime import datetime, timezone

ap, raw = os.environ["AP"], os.environ["RAW"]
errors = []

def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return v if isinstance(v, type(default)) else default
    except FileNotFoundError:
        return default
    except (OSError, ValueError) as exc:
        errors.append({"source": os.path.basename(path), "error": f"unreadable JSON: {exc}"})
        return default

def write_json(name, obj):
    with open(os.path.join(raw, name), "w", encoding="utf-8") as fh:
        json.dump(obj, fh)

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

threads = read_json(os.path.join(ap, "threads.json"), {})
flat, by_thread, unreadable = {}, {}, {}
for rid, t in (threads.get("threads") or {}).items():
    tid = t.get("thread_id") or f"hermes-{rid}"
    msgs, sess, missing = [], [], []
    for s in t.get("sessions") or []:
        role = s.get("role")
        sess.append({"role": role, "session_id": s.get("id"), "cost_status": s.get("cost_status") or "unknown",
                     "container_status": s.get("container_status"), "inferred": bool(s.get("inferred"))})
        if s.get("messages_error"):
            missing.append(f"{s.get('id')}: {s['messages_error']}")
            continue
        for m in s.get("messages") or []:
            ts = iso_z(m.get("timestamp"))
            if ts is None:
                continue
            msgs.append({"ts": ts, "direction": m.get("direction"), "text": m.get("text") or "",
                         "sender": m.get("sender") or role, "role": role, "seq": m.get("seq")})
    by_thread[tid] = sess
    if missing:
        # Partial evidence is no evidence: the supervisor takes no action on a null thread.
        flat[tid] = None
        unreadable[tid] = missing
    else:
        msgs.sort(key=lambda m: (m["ts"], m.get("seq") or 0))
        flat[tid] = msgs
write_json("threads-flat.json", flat)
write_json("sessions-by-thread.json", by_thread)
write_json("threads-unreadable.json", unreadable)

with open(os.environ["ERRORS"], "a", encoding="utf-8") as fh:
    for e in errors:
        fh.write(json.dumps(e) + "\n")
PY

# --- 7. The supervisor ------------------------------------------------------------------------
CORE_SUP=missing
S=$(find_core hermes_supervise.py)
if [ -z "$S" ]; then
  record_error "hermes_supervise.py" "not found next to pull-state.sh or in $AP (core not mirrored)"
elif [ "$CORE_QUEUE" != ok ]; then
  CORE_SUP=skipped
  record_error "hermes_supervise.py" "skipped: no queue output to supervise"
elif python3 "$S" --state "$RAW/queue.json" --threads "$RAW/threads-flat.json" --prs "$AP/prs.json" \
       --nudges "$RAW/nudge-book.json" --sessions "$RAW/sessions-by-thread.json" --config "$AP/config.json" \
       --now "$NOW" > "$RAW/supervise.json" 2> "$RAW/supervise.err"; then
  CORE_SUP=ok
else
  CORE_SUP=failed
  record_error "hermes_supervise.py" "exit non-zero: $(head -c 300 "$RAW/supervise.err")"
fi
[ "$CORE_SUP" = ok ] || echo '{}' > "$RAW/supervise.json"

# --- 8. Merge into state.json (tmp + rename) --------------------------------------------------
AP="$AP" RAW="$RAW" NOW="$NOW" HERE="$HERE" ERRORS="$ERRORS" CORE_QUEUE="$CORE_QUEUE" CORE_SUP="$CORE_SUP" \
LEDGER="$LEDGER" PLAN="$PLAN" MATRIX="$MATRIX" ALERTS="$ALERTS" FORK="$FORK" FORK_CHECKED="$FORK_CHECKED" python3 - <<'PY'
import hashlib, json, os, sys
from datetime import timedelta

ap, raw, now = os.environ["AP"], os.environ["RAW"], os.environ["NOW"]

def load(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return v if isinstance(v, type(default)) else default
    except (OSError, ValueError):
        return default

def sha_file(path):
    try:
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()
    except OSError:
        return None

queue = load(os.path.join(raw, "queue.json"), {})
sup = load(os.path.join(raw, "supervise.json"), {})
threads = load(os.path.join(ap, "threads.json"), {})
unreadable = load(os.path.join(raw, "threads-unreadable.json"), {})
prior = load(os.path.join(raw, "prior-state.json"), {})
prs = load(os.path.join(ap, "prs.json"), [])
config = load(os.path.join(ap, "config.json"), {})
config = {"wip": 3, "paused": False, **config}
errors = [json.loads(l) for l in open(os.environ["ERRORS"], encoding="utf-8") if l.strip()]
for e in threads.get("collector_errors") or []:
    if e not in errors:
        errors.append(e)

state = dict(queue)
state["supervise"] = sup
state["actions"] = list(sup.get("actions") or [])
alerts = []
for a in list(queue.get("alerts") or []) + list(sup.get("alerts") or []):
    if a not in alerts:
        alerts.append(a)
state["alerts"] = alerts
state["summary"] = sup.get("summary") or {}
state.setdefault("eligible_next", [])
state.setdefault("rows", {})
state["config"] = config
state["paused"] = bool(config.get("paused", False))
state["threads_unreadable"] = unreadable
state["dispatch_overlays"] = {rid: r.get("dispatched_by") for rid, r in (prior.get("rows") or {}).items()
                              if r.get("dispatched_by")}

# signals the next queue run gates on (compute_gating: tester_pass; ledger-drift: merged / not_merged)
sup_rows = sup.get("rows") or {}
signals = {"tester_pass": [], "merged": [], "not_merged": []}
for rid, r in sup_rows.items():
    stage = r.get("stage")
    passed = stage in ("review", "gate", "merged") or any((t or {}).get("verdict") == "PASS" for t in r.get("test_rounds") or [])
    if passed:
        signals["tester_pass"].append(rid)
    if stage == "merged" and "fork MERGED" in (r.get("reason") or ""):
        signals["merged"].append(rid)
for a in alerts:
    if a.get("kind") == "ledger-drift" and a.get("row") and "fork" in str(a.get("detail") or "") and "ledger merged" in str(a.get("detail") or ""):
        signals["not_merged"].append(a["row"])
state["signals"] = {k: sorted(set(v)) for k, v in signals.items()}

sources = dict(queue.get("sources") or {})
sources["ledger"] = {**(sources.get("ledger") or {}), "checked": os.path.exists(os.environ["LEDGER"]), "path": os.environ["LEDGER"], "sha256": sha_file(os.environ["LEDGER"])}
sources["plan"] = {**(sources.get("plan") or {}), "checked": os.path.exists(os.environ["PLAN"]), "path": os.environ["PLAN"], "sha256": sha_file(os.environ["PLAN"])}
sources["matrix"] = {**(sources.get("matrix") or {}), "checked": os.path.exists(os.environ["MATRIX"]), "path": os.environ["MATRIX"], "sha256": sha_file(os.environ["MATRIX"])}
sources["fork"] = {"checked": os.environ["FORK_CHECKED"] == "true", "slug": os.environ["FORK"], "count": len(prs),
                   "stale": os.environ["FORK_CHECKED"] != "true" and bool(prs)}
sources["sessions"] = {"checked": bool(threads.get("sessions_checked")), **(threads.get("counts") or {}),
                       "roles": threads.get("roles") or {}, "filter": threads.get("filter") or {},
                       "unreadable_threads": sorted(unreadable)}
sources["core"] = {"queue": os.environ["CORE_QUEUE"], "supervise": os.environ["CORE_SUP"]}
state["sources"] = sources
state["plan"] = {"sha256": queue.get("plan_sha256") or sources["plan"]["sha256"],
                 "matrix_sha256": queue.get("matrix_sha256") or sources["matrix"]["sha256"],
                 "ok": queue.get("plan_ok"), "pinned": config.get("plan_sha256")}
state["paths"] = {"autopilot_dir": ap, "ledger": os.environ["LEDGER"], "plan": os.environ["PLAN"], "matrix": os.environ["MATRIX"],
                  "alerts": os.environ["ALERTS"], "nudges": os.path.join(ap, "nudges.json")}

# A header-located ledger read, independent of the core (scorecard.py sits next to this file).
sys.path.insert(0, os.environ["HERE"])
try:
    import scorecard
    with open(os.environ["LEDGER"], encoding="utf-8") as fh:
        ledger_md = fh.read()
    parsed = scorecard.parse_ledger(ledger_md, timedelta(minutes=int(config.get("install_tz_offset_minutes", 330))))
    counts = {"merged": 0, "blocked": 0, "in_flight": 0}
    for r in parsed["rows"].values():
        counts[r["outcome"] if r["outcome"] in counts else "in_flight"] += 1
    state["ledger_rows"] = {"rows": parsed["rows"], "other_rows": parsed["other_rows"], "duplicates": parsed["duplicates"],
                            "id_spelling": parsed.get("spelling", []), "counts": counts, "header_found": parsed["header_found"]}
    if not parsed["header_found"]:
        errors.append({"source": "ledger", "error": "header row not found (row-id | ... | merged/blocked)"})
    if "in_flight" not in state:
        state["in_flight"] = sorted(k for k, r in parsed["rows"].items() if r["outcome"] == "in_flight")
    if not isinstance(state.get("wip"), dict):
        n = len(state["in_flight"])
        state["wip"] = {"limit": config["wip"], "in_flight": n, "free": max(0, int(config["wip"]) - n), "source": "ledger fallback"}
except FileNotFoundError:
    state.setdefault("in_flight", [])
except Exception as exc:  # the fallback read must never sink the tick
    errors.append({"source": "scorecard.parse_ledger", "error": f"{type(exc).__name__}: {exc}"})

state["collector_errors"] = errors
state["generated_at"] = now
state["tick"] = "pull-state"
tmp = os.path.join(ap, ".state.json.tmp")
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(state, fh, indent=2, default=str)
os.replace(tmp, os.path.join(ap, "state.json"))
wip = state.get("wip") if isinstance(state.get("wip"), dict) else {}
summary = {
    "in_flight": len(state.get("in_flight") or []),
    "free": wip.get("free"),
    "eligible_next": [e.get("id") for e in state.get("eligible_next") or [] if isinstance(e, dict)][:5],
    "dispatch_paused": state.get("dispatch_paused"),
    "actions": len(state["actions"]),
    "alerts": len(alerts),
    "errors": len(errors),
    "unreadable_threads": sorted(unreadable),
    "core": sources["core"],
}
print("pull-state: state.json written " + json.dumps(summary))
PY
