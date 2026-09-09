#!/usr/bin/env python3
"""record.py: the autopilot's bookkeeping writes, done atomically.

The two tick prompts ask the Orchestrator to record every send it makes
(nudge, alert, dispatch, redispatch, authorized round) so the next tick can
enforce the bounds (one nudge per row per 6 h, one alert per row and state per
24 h, never dispatch twice). Hand-editing JSON from an agent turn is the
failure mode this script removes: one command per event, read-modify-write,
tmp + rename.

  record.py nudged      --row ID --role R --state S --text T
  record.py alerted     --row ID --reason R --line "- <ISO> · ID · ..." [--alerts-md PATH]
  record.py dispatched  --row ID [--batch B]
  record.py redispatched --row ID --role R --stage S
  record.py round3      --row ID --reason R

Common flags: --file (default /workspace/shared/hermes/autopilot/nudges.json),
--now (ISO, default utcnow). `alerted` also inserts --line into alerts.md
directly under the header, newest first; existing lines are never edited.
Prints the appended entry as JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

DEFAULT_FILE = "/workspace/shared/hermes/autopilot/nudges.json"
DEFAULT_ALERTS = "/workspace/agent/reports/status/alerts.md"
ALERTS_HEADER = (
    "# Hermes autopilot alerts (newest first)\n\n"
    "Appended by the supervise tick; the human's 6-hourly check reads it. "
    "Lines are never edited or removed.\n\n"
)
EMPTY = {"nudges": [], "alerts": [], "dispatched": [], "redispatched": [], "round3": []}


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def atomic_write(path: str, text: str) -> None:
    d = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".record-", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def load(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        data = {}
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path}: not JSON ({exc}); fix or move it before recording") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: expected an object")
    for k, v in EMPTY.items():
        data.setdefault(k, list(v))
    return data


def insert_alert_line(path: str, line: str) -> None:
    """Newest first: the new line goes directly above the first existing `- ` line."""
    line = line.rstrip("\n")
    try:
        with open(path, encoding="utf-8") as fh:
            body = fh.read()
    except FileNotFoundError:
        body = ALERTS_HEADER
    if not body.strip():
        body = ALERTS_HEADER
    lines = body.split("\n")
    idx = next((i for i, l in enumerate(lines) if l.startswith("- ")), None)
    if idx is None:
        if not body.endswith("\n"):
            body += "\n"
        if not body.endswith("\n\n"):
            body += "\n"
        atomic_write(path, body + line + "\n")
        return
    lines.insert(idx, line)
    atomic_write(path, "\n".join(lines))


def main() -> int:
    ap = argparse.ArgumentParser(description="Hermes autopilot bookkeeping")
    ap.add_argument("kind", choices=["nudged", "alerted", "dispatched", "redispatched", "round3"])
    ap.add_argument("--row", required=True)
    ap.add_argument("--role")
    ap.add_argument("--state")
    ap.add_argument("--stage")
    ap.add_argument("--text")
    ap.add_argument("--reason")
    ap.add_argument("--batch")
    ap.add_argument("--line", help="alerted: the full alerts.md line")
    ap.add_argument("--alerts-md", default=DEFAULT_ALERTS)
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--now", default=None)
    args = ap.parse_args()
    now = args.now or utcnow_iso()

    entry: dict = {"row": args.row, "at": now}
    if args.kind == "nudged":
        if not args.role or not args.text:
            ap.error("nudged needs --role and --text")
        entry.update({"role": args.role, "state": args.state, "text": args.text})
        key = "nudges"
    elif args.kind == "alerted":
        if not args.line:
            ap.error("alerted needs --line")
        entry.update({"reason": args.reason, "line": args.line.rstrip("\n")})
        key = "alerts"
    elif args.kind == "dispatched":
        entry.update({"batch": args.batch})
        key = "dispatched"
    elif args.kind == "redispatched":
        if not args.role:
            ap.error("redispatched needs --role")
        entry.update({"role": args.role, "stage": args.stage})
        key = "redispatched"
    else:
        entry.update({"reason": args.reason})
        key = "round3"

    data = load(args.file)
    data[key].append(entry)
    atomic_write(args.file, json.dumps(data, indent=2) + "\n")
    if args.kind == "alerted":
        insert_alert_line(args.alerts_md, args.line)
    json.dump(entry, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
