#!/usr/bin/env bash
# collect-acks.sh: host-side snapshot of every hermes-<ROW> session's newest processing_ack row, for the
# supervise tick's bounce and idle-turn detection (hermes_supervise.py --acks; autopilot.md §2.5).
#
# Why host-side: processing_ack lives in each session's outbound.db under data/v2-sessions/<agent-group>/
# <session>/, which the Orchestrator container cannot see (it mounts only its own session DBs). The host
# joins role + thread from the central DB (scripts/q.ts, the in-tree wrapper — `./bin/ncl sessions list`
# + `groups list` is the fallback), keeps only ACTIVE sessions whose thread is a matrix row
# (hermes-<ROW>), reads their outbound.db files in ONE bun invocation (bun:sqlite, readonly), and writes
#   data/shared/hermes/autopilot/acks.json   (container: /workspace/shared/hermes/autopilot/acks.json)
# atomically (tmp + rename):
#   {"generated_at": ISO, "sessions": {"<session-id>": {"status", "changed", "role", "thread_id", "thread_id_raw",
#    "container_status", "message_id"[, "role_unmatched": true][, "thread_case": true][, "bounces_24h": n,
#    "last_bounce_at": ISO|null]}}, "counts": {...}, "errors": [{"session_id", "error"}],
#    "thread_case": [{"session_id", "role", "thread_id", "thread_id_raw"}], "bounce_log": {...}}
# `thread_id` is the CANONICAL row thread (rowid.canon_thread: hermes-iso-f13 -> hermes-ISO-F13), so a session a
# role opened on a mis-cased thread is attributed to its row; `thread_id_raw` is the thread as stored — the one a
# message must be sent into to reach that session. Such sessions are flagged `thread_case` and listed once more
# at the top level (`THREAD-CASE:` line in the output) — the 2026-09-16 ISO-F13 tester/reviewer incident.
# `bounces_24h` / `last_bounce_at` come from logs/nanoclaw.log (step 3b): the host sweep's "Re-armed bounced a2a
# handoff" lines per session over the last 24 h. The sweep CLEARS the bounced processing_ack row when it re-arms,
# so the newest ack alone hides a session that bounced 3x in an hour (ISO-F14, 2026-09-16); the log is the durable
# record. Both fields are OMITTED when the log is unreadable — the supervisor then behaves exactly as before.
# `role` is resolved the way collect_threads.role_groups does: the group FOLDER when it is one of the five
# role names, else the group NAME when that is, else the folder as-is with `role_unmatched: true` and a
# count in `counts.role_unmatched` — the supervisor matches acks to the SLO role by this string, so an
# unmatched one is flagged, never silently a miss.
# pull-state.sh passes the file as --acks; the supervisor treats one older than 2 h as absent (both
# detections off — never a guess), which is why this runs every 15 min from refresh-viewers.sh
# (`>> logs/collect-acks.log`, never fatal there). A run that finds no session source writes nothing,
# so the previous file simply ages out.
#
# Budget: < 60 s on ~200 sessions — one q.ts call (a few seconds), one bun call over the filtered paths
# (milliseconds each). Both probes run under `timeout`.
#
# Usage: collect-acks.sh
# Env:   ROOT (the checkout; default ~/haaggarwal/nemoclaw-coworkers), OUT (default
#        $ROOT/data/shared/hermes/autopilot/acks.json), BUN (default ~/.bun/bin/bun, else `bun` on PATH),
#        NCL (default $ROOT/bin/ncl), PROBE_TIMEOUT (40), NOW_OVERRIDE (tests),
#        HOST_LOG (default $ROOT/logs/nanoclaw.log; ACKS_HOST_LOG for tests), LOG_TAIL_BYTES (64 MiB: how much
#        of the log's tail is scanned for the 24 h bounce history),
#        ACKS_SESSIONS_TSV / ACKS_PROBE_JSON (tests: a pre-recorded q.ts row file / bun probe output
#        instead of the live reads; with ACKS_PROBE_JSON the outbound.db files need not exist).
# Exit:  0 written · 9 wrong host · 2 no session source (nothing written) · 3 bun missing · 1 write failed.
set -uo pipefail
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 9;; esac

ROOT=${ROOT:-$HOME/haaggarwal/nemoclaw-coworkers}
OUT=${OUT:-$ROOT/data/shared/hermes/autopilot/acks.json}
NCL=${NCL:-$ROOT/bin/ncl}
PROBE_TIMEOUT=${PROBE_TIMEOUT:-40}
NOW=${NOW_OVERRIDE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}
T0=$(date +%s)
if [ -n "${BUN:-}" ]; then :
elif [ -x "$HOME/.bun/bin/bun" ]; then BUN=$HOME/.bun/bin/bun
elif command -v bun >/dev/null 2>&1; then BUN=$(command -v bun)
else BUN=""; fi
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN=timeout
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN=gtimeout
else TIMEOUT_BIN=""; fi
with_timeout() { # <seconds> <cmd...>
  local secs=$1; shift
  if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$secs" "$@"; else "$@"; fi
}
say() { echo "collect-acks $NOW: $*"; }

[ -d "$ROOT" ] || { say "ROOT $ROOT is not a directory"; exit 2; }
WORK=$(mktemp -d "${TMPDIR:-/tmp}/collect-acks.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
SESSIONS_TSV=$WORK/sessions.tsv   # id|folder|name|thread_id|container_status|status|agent_group_id, one per row

# --- 1. Sessions: role (group folder or name) + thread per ACTIVE session on a hermes-* thread -----------
SOURCE=""
if [ -n "${ACKS_SESSIONS_TSV:-}" ]; then
  cp "$ACKS_SESSIONS_TSV" "$SESSIONS_TSV" && SOURCE=fixture
elif [ -f "$ROOT/scripts/q.ts" ] && [ -f "$ROOT/data/v2.db" ] \
     && (cd "$ROOT" && with_timeout "$PROBE_TIMEOUT" pnpm exec tsx scripts/q.ts data/v2.db \
          "select s.id, g.folder, g.name, s.thread_id, s.container_status, s.status, s.agent_group_id from sessions s join agent_groups g on g.id = s.agent_group_id where s.status = 'active' and s.thread_id like 'hermes-%'" \
          > "$SESSIONS_TSV" 2> "$WORK/q.err"); then
  SOURCE=q.ts
else
  [ -s "$WORK/q.err" ] && say "q.ts failed ($(head -c 160 "$WORK/q.err" | tr '\n' ' ')); trying $NCL"
  if [ -x "$NCL" ] && with_timeout "$PROBE_TIMEOUT" "$NCL" sessions list --limit 5000 --json > "$WORK/sessions.json" 2> "$WORK/ncl.err" \
     && with_timeout "$PROBE_TIMEOUT" "$NCL" groups list --json > "$WORK/groups.json" 2>> "$WORK/ncl.err"; then
    python3 - "$WORK/sessions.json" "$WORK/groups.json" > "$SESSIONS_TSV" <<'PY'
import json, sys
def data(path):
    v = json.load(open(path, encoding="utf-8"))
    return v.get("data") or [] if isinstance(v, dict) else v
groups = {g.get("id"): (g.get("folder") or "", g.get("name") or "") for g in data(sys.argv[2])}
for s in data(sys.argv[1]):
    if (s.get("status") or "active") != "active" or not str(s.get("thread_id") or "").startswith("hermes-"):
        continue
    folder, name = groups.get(s.get("agent_group_id"), ("", ""))
    print("|".join(str(x or "") for x in (s.get("id"), folder, name, s.get("thread_id"),
                                          s.get("container_status"), s.get("status"), s.get("agent_group_id"))))
PY
    SOURCE=ncl
  else
    say "no session source: q.ts and $NCL both failed ($(head -c 160 "$WORK/ncl.err" 2>/dev/null | tr '\n' ' ')); nothing written, $OUT ages out"
    exit 2
  fi
fi

# --- 2. Keep matrix-row threads; list their outbound.db paths ----------------------------------------------
ROOT="$ROOT" WORK="$WORK" PROBE_FIXTURE="${ACKS_PROBE_JSON:-}" python3 - <<'PY'
import glob, json, os, re
root, work = os.environ["ROOT"], os.environ["WORK"]
THREAD_RE = re.compile(r"^hermes-([A-Z0-9]+-F[0-9]+(?:\.[a-z])?)$")
ROLES = ("orchestrator", "hermes-architect", "hermes-builder", "hermes-tester", "hermes-reviewer")  # collect_threads.ROLES
# Inline copy of rowid.canon_thread (autopilot/rowid.py is the canonical copy; a heredoc cannot import it):
# hermes-iso-f13 -> hermes-ISO-F13, hermes-Iso-F10.A -> hermes-ISO-F10.a; non-row threads, None, "" unchanged.
_LOOSE_RE = re.compile(r"^hermes-([A-Za-z0-9]+-[Ff][0-9]+)(\.[A-Za-z])?$")
def canon_thread(thread):
    if not isinstance(thread, str) or not thread:
        return thread
    m = _LOOSE_RE.match(thread)
    return thread if not m else "hermes-" + m.group(1).upper() + (m.group(2).lower() if m.group(2) else "")
sessions, paths, total = {}, [], 0
with open(os.path.join(work, "sessions.tsv"), encoding="utf-8") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line.strip():
            continue
        total += 1
        cols = (line.split("|") + [""] * 7)[:7]
        sid, folder, name, thread_raw, cstatus, status, gid = (c.strip() for c in cols)
        thread = canon_thread(thread_raw)  # attribution by the canonical row thread; the raw one stays on the record
        if not sid or not THREAD_RE.match(thread):
            continue
        # the role string the supervisor matches against the SLO role: folder, else name (collect_threads.role_groups)
        role = folder if folder in ROLES else (name if name in ROLES else folder)
        sessions[sid] = {"role": role, "thread_id": thread, "thread_id_raw": thread_raw, "container_status": cstatus or None, "status": status or None}
        if role not in ROLES:
            sessions[sid]["role_unmatched"] = True
        if thread != thread_raw:
            sessions[sid]["thread_case"] = True  # the session lives on a mis-cased thread: sends must use thread_id_raw
        p = os.path.join(root, "data", "v2-sessions", gid, sid, "outbound.db") if gid else ""
        if not (p and os.path.exists(p)) and not os.environ["PROBE_FIXTURE"]:
            hits = glob.glob(os.path.join(root, "data", "v2-sessions", "*", sid, "outbound.db"))
            p = hits[0] if hits else ""
        if p:
            paths.append(p)
        else:
            sessions[sid]["error"] = "outbound.db not found"
with open(os.path.join(work, "sessions.json"), "w", encoding="utf-8") as fh:
    json.dump({"total": total, "sessions": sessions}, fh)
with open(os.path.join(work, "paths.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(paths) + ("\n" if paths else ""))
PY

# --- 3. ONE bun invocation: newest processing_ack row per outbound.db (readonly) ---------------------------
if [ -n "${ACKS_PROBE_JSON:-}" ]; then
  cp "$ACKS_PROBE_JSON" "$WORK/probe.json"
elif [ ! -s "$WORK/paths.txt" ]; then
  echo '[]' > "$WORK/probe.json"
elif [ -z "$BUN" ]; then
  say "bun not found (~/.bun/bin/bun or PATH); cannot read outbound.db files"
  exit 3
else
  if ! with_timeout "$PROBE_TIMEOUT" "$BUN" -e '
import { Database } from "bun:sqlite";
const text = await Bun.stdin.text();
const out = [];
for (const p of text.split("\n").map((s) => s.trim()).filter(Boolean)) {
  try {
    const db = new Database(p, { readonly: true });
    try {
      db.exec("PRAGMA busy_timeout = 2000");
      const row = db.query("SELECT message_id, status, status_changed FROM processing_ack ORDER BY status_changed DESC LIMIT 1").get();
      out.push(row ? { path: p, message_id: row.message_id, status: row.status, changed: row.status_changed } : { path: p, empty: true });
    } finally {
      db.close();
    }
  } catch (e) {
    out.push({ path: p, error: String((e && e.message) || e) });
  }
}
console.log(JSON.stringify(out));
' < "$WORK/paths.txt" > "$WORK/probe.json" 2> "$WORK/bun.err"; then
    say "bun probe failed ($(head -c 200 "$WORK/bun.err" | tr '\n' ' ')); nothing written, $OUT ages out"
    exit 2
  fi
fi

# --- 3b. Bounce history from the host log (best-effort; log unreadable = the fields are omitted) -----------------
# Every redrive of a bounced a2a turn logs "Re-armed bounced a2a handoff sessionId=... status=... tries=N" and then
# CLEARS the bounced processing_ack row (host-sweep.ts), so the newest ack alone cannot show a repeat. The log stamps
# are `[HH:MM:SS.mmm]` in the host's local clock with NO date, so dating is RELATIVE: the tail is walked backward from
# its last stamped line, whose absolute time is taken as the file's mtime (the last write); each earlier line is
# dated by the clock difference to the line after it — a clock that goes forward while walking back is a midnight
# crossing (+24 h); a backward step under 1 h is clock jitter (an NTP slew, a reordered write), not a day. This needs
# no time-zone assumption and is exact up to the gap between the last stamped line and the last write. What the clock
# CANNOT show is silence, so the walk stops at a dating boundary: the newest "NanoClaw starting" line (src/index.ts
# logs it on every start; the downtime before it may be 10 s or 30 h — a 24.3 h outage reads as 0.3 h on a clock) or a
# quiet stretch longer than LOG_MAX_GAP_H (default 6 h; the host logs only on events, so a quiet night can be one).
# The counted window is therefore "the last 24 h, or since that boundary, whichever is shorter" — `bounce_log.covers_h`
# says how far it reached, `window_partial` whether it fell short of 24 h, `note` why. Re-arm lines beyond the boundary
# in the scanned tail are counted per session as `bounces_undated`: visible, never dated, never read by the
# supervisor's bounce-repeat. Never an invented timestamp: a counted-and-dated line got its date from that walk.
HOST_LOG=${HOST_LOG:-${ACKS_HOST_LOG:-$ROOT/logs/nanoclaw.log}}
LOG_TAIL_BYTES=${LOG_TAIL_BYTES:-67108864}
LOG_MAX_GAP_H=${LOG_MAX_GAP_H:-6}
HOST_LOG="$HOST_LOG" WORK="$WORK" NOW="$NOW" LOG_TAIL_BYTES="$LOG_TAIL_BYTES" LOG_MAX_GAP_H="$LOG_MAX_GAP_H" python3 - <<'PY'
import json, os, re
from datetime import datetime, timedelta, timezone
work, path, now_s = os.environ["WORK"], os.environ["HOST_LOG"], os.environ["NOW"]
WINDOW_H, MAX_GAP_H = 24.0, float(os.environ.get("LOG_MAX_GAP_H") or 6.0)
REARM = "Re-armed bounced a2a handoff"
HOST_START = "NanoClaw starting"  # src/index.ts, the first line of every host start
ANSI = re.compile(r"\x1b\[[0-9;]*m")
STAMP = re.compile(r"^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s+(\S+)\s+(.*)$")
SID = re.compile(r'sessionId="([^"]+)"')
STATUS = re.compile(r'status="([^"]+)"')
meta = {"path": path, "status": "missing", "window_h": WINDOW_H, "max_gap_h": MAX_GAP_H, "lines_scanned": 0, "stamped": 0,
        "rearms_24h": 0, "rearms_undated": 0, "anchor": None, "covers_h": None, "window_partial": None, "note": None}
doc = {"meta": meta, "sessions": {}}
def finish(note=None):
    if note:
        meta["note"] = note
    with open(os.path.join(work, "bounces.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh)
    raise SystemExit(0)
listed = set(json.load(open(os.path.join(work, "sessions.json"), encoding="utf-8"))["sessions"])
try:
    st = os.stat(path)
    with open(path, "rb") as fh:
        start = max(0, st.st_size - int(os.environ["LOG_TAIL_BYTES"]))
        fh.seek(start)
        data = fh.read()
except OSError as exc:
    finish(f"host log unreadable: {exc}")
now = datetime.fromisoformat(now_s.replace("Z", "+00:00"))
anchor = datetime.fromtimestamp(st.st_mtime, timezone.utc)  # the last write = the last stamped line, up to trailing unstamped lines
lines = data.decode("utf-8", "replace").split("\n")
if start > 0 and lines:
    lines = lines[1:]  # a partial first line
meta["lines_scanned"] = len(lines)
per = {}
def entry(sid):
    return per.setdefault(sid, {"bounces_24h": 0, "last_bounce_at": None, "bounces_undated": 0, "statuses": []})
def rearm_sid(text):
    """The LISTED session a re-arm line names, else None."""
    if REARM not in text:
        return None
    sm = SID.search(text)
    return sm.group(1) if sm and sm.group(1) in listed else None
prev_clock = None
offset = 0.0  # seconds back from the anchor
stopped = None
undated_from = -1  # index of the newest line beyond the dating boundary (its date is unknown); -1 = no boundary hit
i = len(lines)
while i > 0:
    i -= 1
    m = STAMP.match(ANSI.sub("", lines[i]).rstrip("\r"))
    if not m:
        continue
    clock = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 1000.0
    hhmmss = f"{m.group(1)}:{m.group(2)}:{m.group(3)}"
    if prev_clock is not None:
        delta = prev_clock - clock
        if -3600.0 < delta < 0:
            delta = 0.0  # a small backward clock step (NTP slew, a reordered write): jitter, not a day
        elif delta < 0:
            delta += 86400.0  # the clock went forward while walking back: a midnight crossing
        if delta > MAX_GAP_H * 3600:
            stopped = (f"stopped at a {delta / 3600:.1f}h quiet stretch between stamped lines ({hhmmss}); the clock cannot show whether it "
                       f"hides a day, so earlier lines are not dated (bounces_undated counts their re-arms)")
            undated_from = i  # this line is beyond the boundary
            break
        offset += delta
    prev_clock = clock
    meta["stamped"] += 1
    when = anchor - timedelta(seconds=offset)
    age_h = (now - when).total_seconds() / 3600.0
    if age_h > WINDOW_H:
        break  # dated, merely older than the window: nothing before it is counted
    text = m.group(6)
    if text.startswith(HOST_START):
        stopped = (f"stopped at a host start ({hhmmss}, {when.strftime('%Y-%m-%dT%H:%M:%SZ')}); the downtime before it has no clock, "
                   f"so earlier lines are not dated (bounces_undated counts their re-arms)")
        undated_from = i - 1  # the start line itself is dated; everything before it is not
        break
    sid = rearm_sid(text)
    if sid is None:
        continue
    e = entry(sid)
    e["bounces_24h"] += 1
    stamp = when.strftime("%Y-%m-%dT%H:%M:%SZ")
    if e["last_bounce_at"] is None or stamp > e["last_bounce_at"]:
        e["last_bounce_at"] = stamp
    stm = STATUS.search(text)
    if stm and stm.group(1) not in e["statuses"]:
        e["statuses"].append(stm.group(1))
    meta["rearms_24h"] += 1
# beyond the boundary: the listed sessions' re-arms in the rest of the scanned tail, counted and dated by nothing
j = undated_from
while j >= 0:
    m = STAMP.match(ANSI.sub("", lines[j]).rstrip("\r"))
    j -= 1
    sid = rearm_sid(m.group(6)) if m else None
    if sid is not None:
        entry(sid)["bounces_undated"] += 1
        meta["rearms_undated"] += 1
covered = offset / 3600.0 if prev_clock is not None else 0.0
reach_h = (now - anchor).total_seconds() / 3600.0 + covered  # how far back from NOW the counted tail reaches
meta.update(status="ok", anchor=anchor.strftime("%Y-%m-%dT%H:%M:%SZ"), covers_h=round(covered, 2), window_partial=reach_h < WINDOW_H)
doc["sessions"] = per
finish(stopped)
PY

# --- 4. Merge and write atomically ------------------------------------------------------------------------
OUT="$OUT" WORK="$WORK" NOW="$NOW" SOURCE="$SOURCE" T0="$T0" python3 - <<'PY'
import json, os, sys, time
out, work, now = os.environ["OUT"], os.environ["WORK"], os.environ["NOW"]
meta = json.load(open(os.path.join(work, "sessions.json"), encoding="utf-8"))
sessions = meta["sessions"]
try:
    bounces = json.load(open(os.path.join(work, "bounces.json"), encoding="utf-8"))
except (OSError, ValueError) as exc:
    bounces = {"meta": {"status": "missing", "note": f"bounce history step failed: {exc}"}, "sessions": {}}
bounce_log = bounces.get("meta") or {"status": "missing"}
bounce_ok = bounce_log.get("status") == "ok"
try:
    probe = json.load(open(os.path.join(work, "probe.json"), encoding="utf-8"))
except (OSError, ValueError) as exc:
    print(f"collect-acks {now}: probe output unreadable ({exc}); nothing written")
    sys.exit(2)
if not isinstance(probe, list):
    probe = []
errors, result = [], {}
counts = {"sessions_total": meta["total"], "hermes_sessions": len(sessions), "probed": 0, "with_ack": 0, "bounced": 0, "completed": 0, "processing": 0, "other": 0, "empty": 0, "errors": 0,
          "role_unmatched": sum(1 for s in sessions.values() if s.get("role_unmatched")),
          "thread_case": sum(1 for s in sessions.values() if s.get("thread_case")),
          "bounce_history": 0, "rearms_24h": int(bounce_log.get("rearms_24h") or 0) if bounce_ok else None,
          "rearms_undated": int(bounce_log.get("rearms_undated") or 0) if bounce_ok else None}
thread_case = [{"session_id": sid, "role": s.get("role"), "thread_id": s.get("thread_id"), "thread_id_raw": s.get("thread_id_raw")}
               for sid, s in sessions.items() if s.get("thread_case")]
for sid, s in sessions.items():
    if s.get("error"):
        errors.append({"session_id": sid, "error": s.pop("error")})
def attach(sid, s, e):
    """The session list's flags and, when the host log was readable, the session's re-arm counts."""
    if s.get("role_unmatched"):
        e["role_unmatched"] = True
    if s.get("thread_case"):
        e["thread_case"] = True
    if bounce_ok:
        # the host log's re-arm count for this session over the counted window (0 = readable log, no re-arm); omitted when
        # the log could not be read, so the supervisor never guesses. bounces_undated (only when > 0): re-arm lines beyond
        # the dating boundary (a host start, a quiet stretch) in the scanned tail — visible, never dated, never a repeat
        b = (bounces.get("sessions") or {}).get(sid) or {}
        e["bounces_24h"] = int(b.get("bounces_24h") or 0)
        e["last_bounce_at"] = b.get("last_bounce_at")
        if b.get("bounces_undated"):
            e["bounces_undated"] = int(b["bounces_undated"])
        if e["bounces_24h"]:
            counts["bounce_history"] += 1
for p in probe:
    if not isinstance(p, dict) or not p.get("path"):
        continue
    sid = os.path.basename(os.path.dirname(p["path"]))
    s = sessions.get(sid)
    if s is None:
        continue
    counts["probed"] += 1
    if p.get("error"):
        errors.append({"session_id": sid, "error": str(p["error"])[:300]})
        continue
    if p.get("empty") or not p.get("status"):
        counts["empty"] += 1
        b = ((bounces.get("sessions") or {}).get(sid) or {}) if bounce_ok else {}
        if b.get("bounces_24h") or b.get("bounces_undated"):
            # a first-turn session whose only ack row was the bounced one the sweep DELETED (deleteBouncedClaims; the retry
            # is claimed only after a 1..60 min backoff): no ack to read, yet the host log shows its re-arms. Surface them as
            # an ack-less entry so the supervisor's bounce-repeat sees the session — role_ack skips an entry whose `changed`
            # is null, so it never reads as a current ack, and it is not counted under `acks`.
            result[sid] = {"status": None, "changed": None, "message_id": None, "ack_empty": True, **{k: s.get(k) for k in ("role", "thread_id", "thread_id_raw", "container_status")}}
            attach(sid, s, result[sid])
        continue
    status = str(p["status"])
    result[sid] = {"status": status, "changed": p.get("changed"), "message_id": p.get("message_id"), **{k: s.get(k) for k in ("role", "thread_id", "thread_id_raw", "container_status")}}
    attach(sid, s, result[sid])
    counts["with_ack"] += 1
    if status.startswith("bounced"):
        counts["bounced"] += 1
    elif status == "completed":
        counts["completed"] += 1
    elif status == "processing":
        counts["processing"] += 1
    else:
        counts["other"] += 1
counts["errors"] = len(errors)
doc = {"generated_at": now, "source": os.environ["SOURCE"], "sessions": result, "counts": counts, "errors": errors[:50],
       "thread_case": thread_case, "bounce_log": bounce_log}
os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
tmp = out + ".tmp"
try:
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, sort_keys=True)
        fh.write("\n")
    os.replace(tmp, out)
except OSError as exc:
    print(f"collect-acks {now}: write failed ({exc})")
    sys.exit(1)
took = int(time.time()) - int(os.environ["T0"])
if bounce_ok:
    hist = (f"bounce history {counts['bounce_history']} sessions / {counts['rearms_24h']} re-arms 24h"
            + (f", {counts['rearms_undated']} undated" if counts["rearms_undated"] else "")
            + f" (log covers {bounce_log.get('covers_h')}h" + (", partial" if bounce_log.get("window_partial") else "") + ")")
else:
    hist = f"bounce history off ({bounce_log.get('note') or 'host log unreadable'})"
print(f"collect-acks {now}: {counts['hermes_sessions']} hermes-row sessions of {counts['sessions_total']} ({os.environ['SOURCE']}), "
      f"probed {counts['probed']}, acks {counts['with_ack']} (bounced {counts['bounced']}, completed {counts['completed']}, processing {counts['processing']}), "
      f"errors {counts['errors']}, role unmatched {counts['role_unmatched']}, thread case {counts['thread_case']}, {hist} -> {out} in {took}s")
if bounce_ok and bounce_log.get("note"):
    print(f"collect-acks {now}: bounce history: {bounce_log['note']}")
for t in thread_case:
    # a role opened its session on a mis-cased row thread: attributed to the row here; the durable fix is in the spine
    print(f"collect-acks {now}: THREAD-CASE: session {t['session_id']} ({t['role']}) lives on thread {t['thread_id_raw']!r}, row thread is {t['thread_id']!r} — sends to it must use the raw thread")
PY
