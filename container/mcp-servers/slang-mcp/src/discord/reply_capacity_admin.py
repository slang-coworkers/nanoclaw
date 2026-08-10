"""Operator tool for reply-capacity reservations that never settled.

WHY THIS EXISTS
---------------
`reply_capacity.py` keeps an unsettled reservation CHARGED however old it gets,
because the audit log cannot tell "the process died before POSTing" from "the
process died after ingress returned 200". Expiring it on age forgets a reply the
user can already see and lets the next admission pass the 15-reply cap.

The cost of that correctness is real: a crash permanently consumes one reply of
a thread's quota. That is an availability bug of its own, so it must never be
silent. This is the other half of the deal — the charge is visible here, and
clearing it is a deliberate human act with a recorded reason, not a timeout.

    # what is stuck, and where
    python -m src.discord.reply_capacity_admin list

    # settle one, having established what actually happened
    python -m src.discord.reply_capacity_admin settle <thread_id> <reservation_id> --failed
    python -m src.discord.reply_capacity_admin settle <thread_id> <reservation_id> --accepted

`--failed` refunds the charge (use when you have confirmed the reply never
reached Discord). `--accepted` keeps it (use when you can see the reply in the
thread). Both append a normal terminal row, so every other reader folds the
result through the same state machine — this tool has no privileged path.

The durable fix is for dashboard ingress to treat the reservation id as an
idempotency key and report whether it accepted that id, which would make these
reconcilable automatically. The forwarders already put `reservation_id` in the
POST body so that work needs no further change on this side.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from .reply_capacity import EVENT_ACCEPTED, EVENT_FAILED, fold_rows

FEEDBACK_DIR = os.environ.get("DISCORD_FEEDBACK_DIR", "/tmp/discord-feedback")


def _state_path() -> str:
    return os.path.join(FEEDBACK_DIR, "thread_state.jsonl")


def _load_rows(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                continue
    return rows


def cmd_list(args: argparse.Namespace) -> int:
    path = _state_path()
    rows = _load_rows(path)
    if not rows:
        print(f"no thread state at {path} — nothing to report")
        return 0

    stuck = 0
    for tid, cap in sorted(fold_rows(rows).items()):
        unresolved = cap.unresolved_ids()
        if not unresolved and not args.all:
            continue
        stuck += len(unresolved)
        print(
            f"{tid}  charged={cap.charged()} accepted={cap.accepted} "
            f"failed={cap.failed} unresolved={len(unresolved)}"
            + (f" conflicts={cap.conflicts}" if cap.conflicts else "")
            + (f" orphans={cap.orphan_terminals}" if cap.orphan_terminals else "")
        )
        for rid in unresolved:
            print(f"        unresolved  {rid}")

    if stuck:
        print()
        print(f"{stuck} reservation(s) hold quota with no known outcome.")
        print("Establish what happened, then settle each one:")
        print("  python -m src.discord.reply_capacity_admin settle <thread_id> <id> --failed")
        return 1
    print("ok: every reservation has settled.")
    return 0


def cmd_settle(args: argparse.Namespace) -> int:
    if args.accepted == args.failed:
        print("choose exactly one of --accepted / --failed", file=sys.stderr)
        return 2

    path = _state_path()
    caps = fold_rows(_load_rows(path), thread_id=args.thread_id)
    cap = caps.get(args.thread_id)
    if cap is None:
        print(f"::error::no state for thread {args.thread_id}", file=sys.stderr)
        return 2
    if args.reservation_id not in cap.pending:
        settled_as = cap.settled.get(args.reservation_id)
        if settled_as:
            print(
                f"::error::{args.reservation_id} already settled as {settled_as} — "
                "settlement happens once",
                file=sys.stderr,
            )
        else:
            print(
                f"::error::{args.reservation_id} is not a reservation on this thread",
                file=sys.stderr,
            )
        return 2

    event = EVENT_ACCEPTED if args.accepted else EVENT_FAILED
    row = {
        "thread_id": args.thread_id,
        "event": event,
        "reservation_id": args.reservation_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        # Provenance: this row was written by a human, not by a forwarder that
        # observed the outcome. Anyone auditing the log later should be able to
        # tell the difference.
        "settled_by": "operator",
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(row) + "\n")

    print(f"{args.thread_id}: {args.reservation_id} settled as {event}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="reply_capacity_admin", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="threads holding unresolved reservations")
    p_list.add_argument("--all", action="store_true", help="include healthy threads")
    p_list.set_defaults(func=cmd_list)

    p_settle = sub.add_parser("settle", help="settle one unresolved reservation")
    p_settle.add_argument("thread_id")
    p_settle.add_argument("reservation_id")
    p_settle.add_argument("--accepted", action="store_true", help="the reply WAS delivered")
    p_settle.add_argument("--failed", action="store_true", help="the reply was NOT delivered")
    p_settle.set_defaults(func=cmd_settle)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
