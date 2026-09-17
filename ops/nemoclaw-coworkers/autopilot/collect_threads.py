#!/usr/bin/env python3
"""collect_threads.py: per-row thread activity for the Hermes autopilot.

Runs inside the Orchestrator container (cli_scope=global), called by
pull-state.sh. The dashboard API is not reachable from a container, so the
only view of what the chain roles said on a row's thread is `ncl`: the
session list for the five groups, the merged transcript of every session that
sits on a `hermes-<ID>` thread, and the live cost-cap status per session.

Nothing here decides anything. The state machine, the SLOs and the nudge
bound live in hermes_supervise.py; this script only assembles what that core
reads and records every read that failed under "collector_errors", naming the
command, so a missing fact reads as "unknown" and never as "nothing to say".

Input (files pull-state.sh already fetched; each may be the `ncl --json`
frame `{"ok": true, "data": [...]}` or the bare `data` list):

  --groups    groups.json    ncl groups list --json
  --sessions  sessions.json  ncl sessions list --limit N --json
  --ncl       the ncl binary to call for the per-session reads (default: ncl)
  --limit     rows per session transcript (default 200; ncl caps at 500)
  --scan-fallback N  when a role has no per-thread session at all (thread_id
              is only populated in per-thread session mode), read its N newest
              active sessions and attribute them to rows by the tokens
              `hermes-<ID>`, `[<ID>]` or `<ID>:` in the text (default 5)
  --max-sessions  hard cap on transcript reads per run (default 80)
  --rows      comma-separated row ids whose threads get their transcripts read
              (pull-state.sh passes the queue's in-flight rows). Sessions on other
              row threads are still listed, with `messages_error: not read: row not
              in flight`, so the dispatch tick can still see that a thread exists.
              Absent: every matrix-row thread is read.
  --deadline-s  wall-clock budget for transcript reads (0 = none). Once spent, the
              remaining sessions are listed unread (`messages_error: not read:
              deadline ...`) and one collector_errors entry says how many.
  --operator-sessions N  pass 3 (0 disables; runs FIRST, before the row reads): the
              Orchestrator's N newest non-row sessions active in the last --operator-since-h
              hours (48) — the operator DM / main thread, system:tasks:*; never hermes-status,
              never a row thread, never the autopilot's own `system:tasks:hermes-ap-*` series
              (its run output quotes the asks) — are read too, NEWEST rows first (`--reverse`,
              so a long-lived DM is read from its end), for the operator-ask detection
              (autopilot.md §2.5, the 2026-09-16/17 asks the row threads alone never showed).
              Default 6.
  --operator-since-h H   window for those sessions and their messages (default 48)
  --operator-tail N      the last N outbound messages kept per session (default 40), plus
              every inbound line since the oldest kept (the operator's answers)
  --operator-head N      text head kept per message (default 600 chars)
  --operator-deadline-s S  pass 3's OWN wall-clock reserve (default 3; 0 = none), measured
              from its start and independent of --deadline-s: the row reads can never starve
              it, and it never eats into their budget (their clock starts after it). Sessions
              it could not read are listed with `messages_error` and counted `operator_unread`,
              with one collector_errors line.
  --now       ISO timestamp stamped into the output (default: utcnow)

Output, one JSON object on stdout:

  {
    "generated_at": "<ISO>",
    "roles": {"orchestrator": "<group-id>", "hermes-architect": "...", ...},
    "threads": {
      "<ID>": {
        "thread_id": "hermes-<ID>",
        "sessions": [
          {"id", "role", "agent_group_id", "thread_id", "status",
           "container_status", "last_active", "cost_status",
           "inferred": false,
           "messages": [{"seq", "direction", "kind", "timestamp", "sender", "text"}]}
        ]
      }
    },
    "other_threads": ["hermes-P0-LOOP", ...],   # hermes-* threads that are not matrix rows
    "operator_threads": [                         # pass 3: the Orchestrator's non-row sessions, bounded
      {"session_id", "thread_id", "role": "orchestrator", "status", "container_status", "last_active",
       "messages": [{"seq", "direction", "kind", "timestamp", "sender", "text"}]   # text head --operator-head
       [, "messages_error"]}
    ],
    "thread_case": [{"row", "session_id", "role", "thread_id_raw"}],  # sessions on a mis-cased row thread
    "sessions_checked": true,                     # false when the session list itself failed
    "counts": {"sessions_seen": n, "sessions_read": n, "cost_status_read": n, "sessions_unread": n, "thread_case": n,
               "operator_sessions": n, "operator_read": n, "operator_unread": n, "operator_messages": n},
    "filter": {"rows": [...] | null, "deadline_s": 0},
    "collector_errors": [{"source": "ncl sessions messages <sid>", "error": "..."}]
  }

A session whose transcript was not read carries `messages_error`; pull-state.sh
marks the whole thread unreadable for the supervisor (no action on partial
evidence). Message timestamps are passed through as ncl returns them (inbound
ISO 8601, outbound SQL `YYYY-MM-DD HH:MM:SS`); `cost_status` is `unknown` when
the cost-cap read fails, which the core treats as no signal.

Thread ids are canonicalised at ingestion (rowid.canon_thread): a session a role
opened on `hermes-iso-f13` is attributed to row ISO-F13 (the thread record's
`thread_id` is the canonical `hermes-ISO-F13`), while the session record keeps
its REAL `thread_id` and is flagged `thread_case: true`; the top-level
`thread_case` list names every such session. The 2026-09-16 ISO-F13 incident:
the tester's PASS and the reviewer's REQUEST_CHANGES sat on the lower-case
thread and were invisible to the supervisor.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    from rowid import canon_row, canon_thread
    ROWID_ERROR: str | None = None
except ImportError:  # a mirror that predates rowid.py: still collect, say so in collector_errors, never canonicalise by guess
    ROWID_ERROR = "rowid.py not found next to collect_threads.py; thread ids not canonicalised (mis-cased row threads are dropped)"

    def canon_thread(thread):
        return thread

    def canon_row(row):
        return row


ROLES = ("orchestrator", "hermes-architect", "hermes-builder", "hermes-tester", "hermes-reviewer")
ROW_ID = r"[A-Z0-9]+-F[0-9]+(?:\.[a-z])?"
ROW_ID_LOOSE = r"[A-Za-z0-9]+-[Ff][0-9]+(?:\.[A-Za-z])?"  # the same grammar in any casing; canon_row (rowid.py) folds it
THREAD_RE = re.compile(rf"^hermes-({ROW_ID})$")
# Free-text row mentions for the pass-2 scan (a role with no per-thread session). The `hermes-<ROW>` and `[<ROW>]`
# forms are deliberate tags and match in any casing (`hermes-iso-f13`, `[iso-f13]`, the 2026-09-16 thread case); the
# bare `<ROW>:` form stays strict — a lower-case `x-f1:` is ordinary prose.
MENTION_RE = re.compile(rf"(?:hermes-({ROW_ID_LOOSE})\b|\[({ROW_ID_LOOSE})\]|\b({ROW_ID}):)")
SUBPROCESS_TIMEOUT_S = 25
OPERATOR_ROLE = "orchestrator"
STATUS_THREAD = "hermes-status"  # alerts only (posted by the Orchestrator): never an operator thread
AUTOPILOT_TASK_PREFIX = "system:tasks:hermes-ap-"  # the autopilot's own task series (install.sh ensure_series): its run output quotes the asks
OPERATOR_SESSIONS = 6
OPERATOR_SINCE_H = 48.0
OPERATOR_TAIL = 40
OPERATOR_HEAD = 600
OPERATOR_DEADLINE_S = 3.0  # pass 3's own wall-clock reserve (<= 6 reads), independent of --deadline-s for the row reads


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(value) -> datetime | None:
    """ncl timestamps in either shape (inbound ISO 8601 with Z, outbound SQL `YYYY-MM-DD HH:MM:SS`, UTC) -> aware
    datetime, or None. Only used to bound the operator-thread pass; message records keep the raw string."""
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip()
    if v.endswith(("Z", "z")):
        v = v[:-1] + "+00:00"
    v = re.sub(r"(\.\d{1,6})\d+", r"\1", v)
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def load_data(path: str) -> list:
    """Read an `ncl --json` frame or a bare data list from a file."""
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    if isinstance(raw, dict):
        if raw.get("ok") is False:
            err = raw.get("error") or {}
            raise RuntimeError(err.get("message") or "ncl frame ok=false")
        raw = raw.get("data")
    if not isinstance(raw, list):
        raise TypeError("expected a list of rows")
    return raw


class Ncl:
    """Runs `ncl <args> --json` and unwraps the frame; failures raise RuntimeError."""

    def __init__(self, binary: str, timeout_s: int = SUBPROCESS_TIMEOUT_S):
        self.binary = binary
        self.timeout_s = timeout_s

    def run(self, *args: str):
        cmd = [self.binary, *args, "--json"]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=self.timeout_s, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise RuntimeError(f"{type(exc).__name__}: {exc}") from exc
        if proc.returncode != 0:
            raise RuntimeError(f"exit {proc.returncode}: {(proc.stderr or proc.stdout).strip()[:300]}")
        try:
            frame = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"non-JSON output: {exc}") from exc
        if isinstance(frame, dict) and "ok" in frame:
            if frame.get("ok") is False:
                err = frame.get("error") or {}
                raise RuntimeError(err.get("message") or "ok=false")
            return frame.get("data")
        return frame


def role_groups(groups: list) -> dict:
    """folder -> group id for the five roles; name is the fallback match."""
    out: dict = {}
    for g in groups:
        folder = (g.get("folder") or "").strip()
        name = (g.get("name") or "").strip()
        for role in ROLES:
            if role in out:
                continue
            if folder == role or name == role:
                out[role] = g.get("id")
    return out


def project_message(row) -> dict | None:
    """One `ncl sessions messages` row -> the collector's shape; None for a row that is not a dict (skipped, never a crash).
    `text` is always a string (a non-string payload is coerced)."""
    if not isinstance(row, dict):
        return None
    text = row.get("text")
    return {
        "seq": row.get("seq"),
        "direction": row.get("direction"),
        "kind": row.get("kind"),
        "timestamp": row.get("timestamp"),
        "sender": row.get("sender"),
        "text": text if isinstance(text, str) else ("" if text is None else str(text)),
    }


def session_record(s: dict, role: str, inferred: bool = False) -> dict:
    return {
        "id": s.get("id"),
        "role": role,
        "agent_group_id": s.get("agent_group_id"),
        "thread_id": s.get("thread_id"),
        "status": s.get("status"),
        "container_status": s.get("container_status"),
        "last_active": s.get("last_active"),
        "cost_status": "unknown",
        "inferred": inferred,
        "messages": [],
    }


def mentioned_rows(messages: list) -> set:
    """Canonical row ids mentioned in the messages' text (`[loop-f35]` -> LOOP-F35). Only a canonically spelled id is
    ever returned: without rowid.py (identity canon_row) a lower-case tag is dropped rather than minted as a new row."""
    rows: set = set()
    for m in messages:
        for match in MENTION_RE.finditer(m.get("text") or ""):
            row = canon_row(next(g for g in match.groups() if g))
            if re.fullmatch(ROW_ID, row):
                rows.add(row)
    return rows


def collect(
    groups: list,
    sessions: list,
    ncl: Ncl,
    *,
    limit: int,
    scan_fallback: int,
    max_sessions: int,
    now: str,
    rows: set | None = None,
    deadline_s: float = 0.0,
    clock=time.monotonic,
    operator_sessions: int = OPERATOR_SESSIONS,
    operator_since_h: float = OPERATOR_SINCE_H,
    operator_tail: int = OPERATOR_TAIL,
    operator_head: int = OPERATOR_HEAD,
    operator_deadline_s: float = OPERATOR_DEADLINE_S,
) -> dict:
    errors: list = []
    if ROWID_ERROR:
        errors.append({"source": "collect_threads", "error": ROWID_ERROR})
    t0 = clock()
    deadline_hits = 0
    unread = 0
    roles = role_groups(groups)
    group_role = {gid: role for role, gid in roles.items() if gid}
    for role in ROLES:
        if role not in roles:
            errors.append({"source": "ncl groups list", "error": f"no agent group with folder or name {role}"})

    threads: dict = {}
    other_threads: set = set()
    thread_case: list = []
    operator_threads: list = []
    operator_messages = 0
    per_role_threaded: dict = {role: 0 for role in ROLES}
    reads = 0
    cost_reads = 0

    def read_messages(rec: dict) -> bool:
        nonlocal reads, deadline_hits, unread
        if deadline_s and clock() - t0 >= deadline_s:
            rec["messages_error"] = f"not read: deadline {deadline_s:g}s reached"
            deadline_hits += 1
            unread += 1
            return False
        if reads >= max_sessions:
            rec["messages_error"] = f"not read: max-sessions {max_sessions} reached"
            errors.append({"source": "collect_threads", "error": f"max-sessions {max_sessions} reached; {rec['id']} not read"})
            unread += 1
            return False
        reads += 1
        try:
            data = ncl.run("sessions", "messages", rec["id"], "--limit", str(limit), "--full")
            rec["messages"] = [m for m in (project_message(r) for r in (data or [])) if m is not None]
            return True
        except RuntimeError as exc:
            errors.append({"source": f"ncl sessions messages {rec['id']}", "error": str(exc)})
            rec["messages_error"] = str(exc)
            return False

    def read_cost(rec: dict) -> None:
        nonlocal cost_reads
        try:
            data = ncl.run("cost-cap", "status", "--session", rec["id"])
            status = (data or {}).get("status") if isinstance(data, dict) else None
            rec["cost_status"] = status if isinstance(status, str) and status else "unknown"
            cost_reads += 1
        except RuntimeError as exc:
            errors.append({"source": f"ncl cost-cap status --session {rec['id']}", "error": str(exc)})

    ordered = sorted(sessions, key=lambda s: s.get("last_active") or "", reverse=True)

    # Pass 3 — run FIRST: the Orchestrator's NON-row sessions (the operator DM / main thread, system:tasks:*), bounded —
    # the operator-facing asks it mirrors there are invisible on the row threads (2026-09-16/17). Newest first, the last
    # `operator_since_h` hours only, the NEWEST `limit` rows of each transcript (`--reverse`: a plain --limit returns
    # the OLDEST rows, and the DM session is long-lived — seq 384+ in the incident), then `operator_tail` outbound lines
    # per session plus the inbound lines (the operator's answers) since the oldest kept, `operator_head` chars of text
    # each. Never hermes-status (alerts only) and never the autopilot's own task series (`system:tasks:hermes-ap-*`: the
    # supervise tick's run output quotes the standing asks and asks the operator nothing itself). Its reads are their own
    # budget class with their OWN reserve (`operator_deadline_s`, measured from here) so the row reads can never starve
    # them; the row deadline clock (`t0`) starts after it. Counted under `operator_read` / `operator_unread`, one
    # collector_errors line when the reserve hit; `sessions_read` / `sessions_unread` stay about the ROW sessions.
    now_dt = parse_ts(now) or datetime.now(timezone.utc)
    since = now_dt - timedelta(hours=max(0.0, float(operator_since_h)))
    orch_gid = roles.get(OPERATOR_ROLE)
    operator_read = operator_unread = operator_deadline = 0
    t_op = clock()
    if operator_sessions > 0 and orch_gid:
        for s in ordered:
            if len(operator_threads) >= operator_sessions:
                break
            if not isinstance(s, dict) or s.get("agent_group_id") != orch_gid or s.get("status") == "closed":
                continue
            tid_raw = s.get("thread_id") or ""
            tid = canon_thread(tid_raw)
            if THREAD_RE.match(tid) or tid == STATUS_THREAD or str(tid_raw).startswith(AUTOPILOT_TASK_PREFIX):
                continue
            last = parse_ts(s.get("last_active"))
            if last is None or last < since:
                continue
            rec = {"session_id": s.get("id"), "thread_id": tid_raw or None, "role": OPERATOR_ROLE, "status": s.get("status"),
                   "container_status": s.get("container_status"), "last_active": s.get("last_active"), "messages": []}
            if operator_deadline_s and clock() - t_op >= operator_deadline_s:
                rec["messages_error"] = f"not read: operator deadline {operator_deadline_s:g}s reached"
                operator_unread += 1
                operator_deadline += 1
                operator_threads.append(rec)
                continue
            try:
                data = ncl.run("sessions", "messages", rec["session_id"], "--limit", str(limit), "--full", "--reverse")
                msgs = [m for m in (project_message(r) for r in (data or [])) if m is not None]
                recent = [m for m in msgs if (parse_ts(m.get("timestamp")) or since) >= since]
                recent.sort(key=lambda m: (parse_ts(m.get("timestamp")) or since, m.get("seq") or 0))
                outs = [m for m in recent if m.get("direction") != "in"][-max(0, operator_tail):]
                floor = parse_ts(outs[0].get("timestamp")) if outs else None
                ins = [m for m in recent if m.get("direction") == "in" and (floor is None or (parse_ts(m.get("timestamp")) or since) >= floor)]
                kept = sorted(outs + ins, key=lambda m: (parse_ts(m.get("timestamp")) or since, m.get("seq") or 0))
                for m in kept:
                    m["text"] = m["text"][:max(0, operator_head)]
            except (RuntimeError, TypeError, ValueError, AttributeError) as exc:
                # a failed read OR a transcript row the projection cannot take: this session is listed unread, the tick goes on
                errors.append({"source": f"ncl sessions messages {rec['session_id']}", "error": str(exc)})
                rec["messages_error"] = str(exc)
                operator_unread += 1
                operator_threads.append(rec)
                continue
            operator_read += 1
            rec["messages"] = kept
            operator_messages += len(kept)
            operator_threads.append(rec)
    if operator_deadline:
        errors.append({"source": "collect_threads", "error": f"operator threads: deadline {operator_deadline_s:g}s reached; {operator_deadline} sessions not read"})
    t0 = clock()  # the row reads' budget starts now: pass 3 is bounded on its own and never eats into it

    # Pass 1: sessions that sit on a hermes-<ID> thread.
    for s in ordered:
        role = group_role.get(s.get("agent_group_id"))
        if role is None:
            continue
        tid_raw = s.get("thread_id") or ""
        tid = canon_thread(tid_raw)  # hermes-iso-f13 -> hermes-ISO-F13; non-row threads unchanged
        if not tid.startswith("hermes-"):
            continue
        m = THREAD_RE.match(tid)
        if not m:
            other_threads.add(tid_raw)
            continue
        if s.get("status") == "closed":
            continue
        row = m.group(1)
        per_role_threaded[role] += 1
        rec = session_record(s, role)  # thread_id stays the REAL one: a send into hermes-ISO-F13 does not reach hermes-iso-f13
        if tid != tid_raw:
            rec["thread_case"] = True
            thread_case.append({"row": row, "session_id": s.get("id"), "role": role, "thread_id_raw": tid_raw})
        if rows is not None and row not in rows:
            # Listed, not read: the dispatch tick still sees the thread exists (never dispatch
            # twice), the supervisor treats the thread as unreadable, and no budget is spent.
            rec["messages_error"] = "not read: row not in flight"
            rec["skipped"] = True
            unread += 1
        else:
            read_messages(rec)
            read_cost(rec)
        threads.setdefault(row, {"thread_id": tid, "sessions": []})["sessions"].append(rec)

    # Pass 2: roles with no per-thread session at all get a bounded scan.
    for role in ROLES:
        if role not in roles or per_role_threaded[role] or scan_fallback <= 0:
            continue
        gid = roles[role]
        candidates = [s for s in ordered if s.get("agent_group_id") == gid and s.get("status") != "closed"]
        for s in candidates[:scan_fallback]:
            rec = session_record(s, role, inferred=True)
            if not read_messages(rec):
                continue
            rows = mentioned_rows(rec["messages"])
            if not rows:
                continue
            read_cost(rec)
            for row in sorted(rows):
                threads.setdefault(row, {"thread_id": f"hermes-{row}", "sessions": []})["sessions"].append(rec)

    if deadline_hits:
        errors.append({"source": "collect_threads", "error": f"deadline {deadline_s:g}s reached; {deadline_hits} sessions not read"})
    return {
        "generated_at": now,
        "roles": roles,
        "threads": threads,
        "other_threads": sorted(other_threads),
        "thread_case": thread_case,
        "operator_threads": operator_threads,
        "sessions_checked": True,
        "counts": {"sessions_seen": len(sessions), "sessions_read": reads, "cost_status_read": cost_reads, "sessions_unread": unread,
                   "thread_case": len(thread_case), "operator_sessions": len(operator_threads), "operator_read": operator_read,
                   "operator_unread": operator_unread, "operator_messages": operator_messages},
        "filter": {"rows": sorted(rows) if rows is not None else None, "deadline_s": deadline_s},
        "collector_errors": errors,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Hermes autopilot: per-row thread activity via ncl")
    ap.add_argument("--groups", required=True)
    ap.add_argument("--sessions", required=True)
    ap.add_argument("--ncl", default="ncl")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--scan-fallback", type=int, default=5)
    ap.add_argument("--max-sessions", type=int, default=80)
    ap.add_argument("--rows", default=None, help="comma-separated row ids to read transcripts for (default: all)")
    ap.add_argument("--deadline-s", type=float, default=0.0, help="wall-clock budget for transcript reads (0 = none)")
    ap.add_argument("--operator-sessions", type=int, default=OPERATOR_SESSIONS, help="pass 3: the Orchestrator's N newest non-row sessions to read (0 = off)")
    ap.add_argument("--operator-since-h", type=float, default=OPERATOR_SINCE_H, help="pass 3: only sessions / messages active in the last H hours")
    ap.add_argument("--operator-tail", type=int, default=OPERATOR_TAIL, help="pass 3: last N outbound messages per session")
    ap.add_argument("--operator-head", type=int, default=OPERATOR_HEAD, help="pass 3: text head per message (chars)")
    ap.add_argument("--operator-deadline-s", type=float, default=OPERATOR_DEADLINE_S, help="pass 3: its own wall-clock reserve, independent of --deadline-s (0 = none)")
    ap.add_argument("--now", default=None)
    args = ap.parse_args()
    now = args.now or utcnow_iso()
    rows = {r.strip() for r in args.rows.split(",") if r.strip()} if args.rows is not None else None

    errors: list = []
    try:
        groups = load_data(args.groups)
    except (OSError, ValueError, TypeError, RuntimeError) as exc:
        groups = []
        errors.append({"source": "ncl groups list", "error": str(exc)})
    try:
        sessions = load_data(args.sessions)
    except (OSError, ValueError, TypeError, RuntimeError) as exc:
        out = {
            "generated_at": now,
            "roles": role_groups(groups),
            "threads": {},
            "other_threads": [],
            "thread_case": [],
            "operator_threads": [],
            "sessions_checked": False,
            "counts": {"sessions_seen": 0, "sessions_read": 0, "cost_status_read": 0, "sessions_unread": 0, "thread_case": 0,
                       "operator_sessions": 0, "operator_read": 0, "operator_unread": 0, "operator_messages": 0},
            "filter": {"rows": sorted(rows) if rows is not None else None, "deadline_s": args.deadline_s},
            "collector_errors": errors + [{"source": "ncl sessions list", "error": str(exc)}],
        }
        json.dump(out, sys.stdout, indent=2)
        return 0

    out = collect(
        groups,
        sessions,
        Ncl(args.ncl),
        limit=args.limit,
        scan_fallback=args.scan_fallback,
        max_sessions=args.max_sessions,
        now=now,
        rows=rows,
        deadline_s=args.deadline_s,
        operator_sessions=args.operator_sessions,
        operator_since_h=args.operator_since_h,
        operator_tail=args.operator_tail,
        operator_head=args.operator_head,
        operator_deadline_s=args.operator_deadline_s,
    )
    out["collector_errors"] = errors + out["collector_errors"]
    json.dump(out, sys.stdout, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
