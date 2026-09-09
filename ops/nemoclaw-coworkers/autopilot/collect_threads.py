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
    "sessions_checked": true,                     # false when the session list itself failed
    "counts": {"sessions_seen": n, "sessions_read": n, "cost_status_read": n, "sessions_unread": n},
    "filter": {"rows": [...] | null, "deadline_s": 0},
    "collector_errors": [{"source": "ncl sessions messages <sid>", "error": "..."}]
  }

A session whose transcript was not read carries `messages_error`; pull-state.sh
marks the whole thread unreadable for the supervisor (no action on partial
evidence). Message timestamps are passed through as ncl returns them (inbound
ISO 8601, outbound SQL `YYYY-MM-DD HH:MM:SS`); `cost_status` is `unknown` when
the cost-cap read fails, which the core treats as no signal.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

ROLES = ("orchestrator", "hermes-architect", "hermes-builder", "hermes-tester", "hermes-reviewer")
ROW_ID = r"[A-Z0-9]+-F[0-9]+(?:\.[a-z])?"
THREAD_RE = re.compile(rf"^hermes-({ROW_ID})$")
MENTION_RE = re.compile(rf"(?:hermes-({ROW_ID})\b|\[({ROW_ID})\]|\b({ROW_ID}):)")
SUBPROCESS_TIMEOUT_S = 25


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


def project_message(row: dict) -> dict:
    return {
        "seq": row.get("seq"),
        "direction": row.get("direction"),
        "kind": row.get("kind"),
        "timestamp": row.get("timestamp"),
        "sender": row.get("sender"),
        "text": row.get("text") or "",
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
    rows: set = set()
    for m in messages:
        for match in MENTION_RE.finditer(m.get("text") or ""):
            rows.add(next(g for g in match.groups() if g))
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
) -> dict:
    errors: list = []
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
            rec["messages"] = [project_message(r) for r in (data or [])]
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

    # Pass 1: sessions that sit on a hermes-<ID> thread.
    ordered = sorted(sessions, key=lambda s: s.get("last_active") or "", reverse=True)
    for s in ordered:
        role = group_role.get(s.get("agent_group_id"))
        if role is None:
            continue
        tid = s.get("thread_id") or ""
        if not tid.startswith("hermes-"):
            continue
        m = THREAD_RE.match(tid)
        if not m:
            other_threads.add(tid)
            continue
        if s.get("status") == "closed":
            continue
        row = m.group(1)
        per_role_threaded[role] += 1
        rec = session_record(s, role)
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
        "sessions_checked": True,
        "counts": {"sessions_seen": len(sessions), "sessions_read": reads, "cost_status_read": cost_reads, "sessions_unread": unread},
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
            "sessions_checked": False,
            "counts": {"sessions_seen": 0, "sessions_read": 0, "cost_status_read": 0, "sessions_unread": 0},
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
    )
    out["collector_errors"] = errors + out["collector_errors"]
    json.dump(out, sys.stdout, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
