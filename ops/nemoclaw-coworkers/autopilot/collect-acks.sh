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
#   {"generated_at": ISO, "sessions": {"<session-id>": {"status", "changed", "role", "thread_id",
#    "container_status", "message_id"[, "role_unmatched": true]}}, "counts": {...}, "errors": [{"session_id", "error"}]}
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
sessions, paths, total = {}, [], 0
with open(os.path.join(work, "sessions.tsv"), encoding="utf-8") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line.strip():
            continue
        total += 1
        cols = (line.split("|") + [""] * 7)[:7]
        sid, folder, name, thread, cstatus, status, gid = (c.strip() for c in cols)
        if not sid or not THREAD_RE.match(thread):
            continue
        # the role string the supervisor matches against the SLO role: folder, else name (collect_threads.role_groups)
        role = folder if folder in ROLES else (name if name in ROLES else folder)
        sessions[sid] = {"role": role, "thread_id": thread, "container_status": cstatus or None, "status": status or None}
        if role not in ROLES:
            sessions[sid]["role_unmatched"] = True
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

# --- 4. Merge and write atomically ------------------------------------------------------------------------
OUT="$OUT" WORK="$WORK" NOW="$NOW" SOURCE="$SOURCE" T0="$T0" python3 - <<'PY'
import json, os, sys, time
out, work, now = os.environ["OUT"], os.environ["WORK"], os.environ["NOW"]
meta = json.load(open(os.path.join(work, "sessions.json"), encoding="utf-8"))
sessions = meta["sessions"]
try:
    probe = json.load(open(os.path.join(work, "probe.json"), encoding="utf-8"))
except (OSError, ValueError) as exc:
    print(f"collect-acks {now}: probe output unreadable ({exc}); nothing written")
    sys.exit(2)
if not isinstance(probe, list):
    probe = []
errors, result = [], {}
counts = {"sessions_total": meta["total"], "hermes_sessions": len(sessions), "probed": 0, "with_ack": 0, "bounced": 0, "completed": 0, "processing": 0, "other": 0, "empty": 0, "errors": 0,
          "role_unmatched": sum(1 for s in sessions.values() if s.get("role_unmatched"))}
for sid, s in sessions.items():
    if s.get("error"):
        errors.append({"session_id": sid, "error": s.pop("error")})
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
        continue
    status = str(p["status"])
    result[sid] = {"status": status, "changed": p.get("changed"), "message_id": p.get("message_id"), **{k: s.get(k) for k in ("role", "thread_id", "container_status")}}
    if s.get("role_unmatched"):
        result[sid]["role_unmatched"] = True
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
doc = {"generated_at": now, "source": os.environ["SOURCE"], "sessions": result, "counts": counts, "errors": errors[:50]}
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
print(f"collect-acks {now}: {counts['hermes_sessions']} hermes-row sessions of {counts['sessions_total']} ({os.environ['SOURCE']}), "
      f"probed {counts['probed']}, acks {counts['with_ack']} (bounced {counts['bounced']}, completed {counts['completed']}, processing {counts['processing']}), "
      f"errors {counts['errors']}, role unmatched {counts['role_unmatched']} -> {out} in {took}s")
PY
