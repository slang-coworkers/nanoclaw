#!/usr/bin/env python3
"""Resolve one nightly's Slack thread and track a single NanoClaw report delivery.

Slack access is read-only through the container's credential gateway. This script
never posts or writes the session databases: the agent uses the returned
send_message arguments, retaining NanoClaw's destination ACL and critique gate.
A reservation survives crashes between preparing, enqueueing and receiving the
host's delivery receipt. Uncertain sends are held, never blindly retried.
"""
import argparse
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
TS = re.compile(r"[0-9]+\.[0-9]+")
RUN_LINK = re.compile(r"https://github\.com/shader-slang/slang/actions/runs/[0-9]+(?=[\s>|)]|$)")


class DeliveryError(ValueError):
    """Delivery cannot proceed without resolving this condition."""


class Slack:
    def history(self, **params):
        url = "https://slack.com/api/conversations.history?" + urllib.parse.urlencode(params)
        # OneCLI supplies authorization at the proxy; no token is read locally.
        with urllib.request.urlopen(url, timeout=20) as response:
            data = json.load(response)
        if not isinstance(data, dict) or data.get("ok") is not True:
            raise DeliveryError(f"Slack history failed: {data.get('error', 'invalid response') if isinstance(data, dict) else 'invalid response'}")
        return data


def resolve_thread(slack, channel, run_url, created_at):
    created = datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if created.tzinfo is None:
        raise DeliveryError("created_at must include a timezone")
    cursor, seen, matches = "", set(), {}
    for _ in range(20):
        page = slack.history(channel=channel, oldest=str(int(created.timestamp()) - 60),
                             limit=100, cursor=cursor)
        messages = page.get("messages")
        if not isinstance(messages, list):
            raise DeliveryError("Slack history has no messages array")
        for message in messages:
            ts = message.get("ts", "")
            text = message.get("text", "")
            if (TS.fullmatch(ts) and message.get("thread_ts", ts) == ts
                    and (message.get("bot_id") or message.get("subtype") == "bot_message")
                    and "Compile-perf nightly" in text and run_url in RUN_LINK.findall(text)):
                matches[ts] = message
        cursor = (page.get("response_metadata") or {}).get("next_cursor", "")
        if not cursor:
            if page.get("has_more"):
                raise DeliveryError("Slack history is incomplete (missing cursor)")
            break
        if cursor in seen:
            raise DeliveryError("Slack history repeated a cursor")
        seen.add(cursor)
    else:
        raise DeliveryError("Slack history exceeded 20 pages; no thread selected")
    if len(matches) != 1:
        raise DeliveryError(f"expected one nightly Slack parent for {run_url}; found {len(matches)}")
    return next(iter(matches))


@contextlib.contextmanager
def read_db(path):
    db = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA mmap_size=0")
    try:
        yield db
    finally:
        db.close()


def validate_destination(inbound, destination, channel):
    with read_db(inbound) as db:
        row = db.execute("SELECT type, channel_type, platform_id FROM destinations WHERE name = ?",
                         (destination,)).fetchone()
    if row is None or tuple(row) != ("channel", "slack", f"slack:{channel}"):
        raise DeliveryError(f"destination {destination!r} must authorize slack:{channel}")


def save(path, data):
    data["check_after"] = int(time.time()) + 21600 if data["status"] in ("reserved", "failed") else 0
    temp = path.with_suffix(".tmp")
    with temp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(temp, path)


def reconcile(state, inbound, outbound):
    if state["status"] == "delivered":
        return state
    if state.get("session_id") and state["session_id"] != os.environ.get("NANOCLAW_SESSION_ID"):
        raise DeliveryError(f"resume delivery in its source session {state['session_id']}")
    message_id = state.get("message_id")
    if not message_id:
        with read_db(outbound) as db:
            rows = db.execute("SELECT id, content FROM messages_out WHERE channel_type = 'slack' "
                              "AND platform_id = ? AND thread_id = ? AND kind = 'chat'",
                              (f"slack:{state['channel_id']}", state["thread_id"])).fetchall()
        matches = [r["id"] for r in rows if json.loads(r["content"]).get("text") == state["text"]]
        if len(matches) > 1:
            raise DeliveryError("multiple outbound copies found; do not send again")
        if not matches:
            # The first process may still be about to enqueue. Reissuing its
            # arguments here would allow overlapping task wakes to double-post.
            state["status"] = "reserved"
            return state
        message_id = state["message_id"] = matches[0]
    with read_db(inbound) as db:
        receipt = db.execute("SELECT status, platform_message_id FROM delivered WHERE message_out_id = ?",
                             (message_id,)).fetchone()
    state["status"] = "queued"
    if receipt:
        if receipt["status"] == "failed":
            state["status"] = "failed"
        elif receipt["status"] == "delivered" and receipt["platform_message_id"]:
            state["status"] = "delivered"
            state["platform_message_id"] = receipt["platform_message_id"]
            state["delivered_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        else:
            raise DeliveryError("delivery receipt has no confirmed Slack message id")
    return state


def prepare(state_dir, run_id, created_at, report, policy, inbound, outbound, slack):
    config = policy.get("reporting", {})
    channel, destination = config.get("slack_channel_id", ""), config.get("destination", "")
    if not re.fullmatch(r"[CG][A-Z0-9]+", channel) or not destination:
        raise DeliveryError("policy.reporting must configure slack_channel_id and destination")
    validate_destination(inbound, destination, channel)
    run_url = f"https://github.com/shader-slang/slang/actions/runs/{run_id}"
    path = state_dir / f"{run_id}.json"
    if path.exists():
        state = json.loads(path.read_text())
        if state["run_url"] != run_url or state["channel_id"] != channel or state["destination"] != destination:
            raise DeliveryError("delivery target changed; resolve the existing reservation first")
        state = reconcile(state, inbound, outbound)
        save(path, state)
        return public_status(state)
    # Verify both mailbox schemas before reserving a send that cannot be tracked.
    with read_db(outbound) as db:
        db.execute("SELECT id, content, channel_type, platform_id, thread_id, kind FROM messages_out LIMIT 0")
    with read_db(inbound) as db:
        db.execute("SELECT message_out_id, status, platform_message_id FROM delivered LIMIT 0")
    body = Path(report).read_text(encoding="utf-8").strip()
    if not body or len(body) > 12000:
        raise DeliveryError("report must contain 1–12000 characters; shorten it without truncating evidence")
    text = f"[Perf Finding]\n{body}\n\nNightly run: {run_url}"
    ts = resolve_thread(slack, channel, run_url, created_at)
    state = {"run_id": run_id, "run_url": run_url, "channel_id": channel, "destination": destination,
             "created_at": created_at,
             "session_id": os.environ.get("NANOCLAW_SESSION_ID"),
             "parent_ts": ts, "thread_id": f"slack:{channel}:{ts}", "status": "reserved",
             "report_path": str(Path(report).resolve()), "text": text,
             "report_sha256": hashlib.sha256(body.encode()).hexdigest()}
    save(path, state)
    return {**public_status(state), "status": "ready", "tool": "mcp__nanoclaw__send_message",
            "arguments": {"to": destination, "thread_id": state["thread_id"], "text": text}}


def public_status(state):
    return {k: v for k, v in state.items() if k not in ("text", "report_path")}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "status"))
    parser.add_argument("--run-id", required=True, type=int)
    parser.add_argument("--created-at")
    parser.add_argument("--report")
    mounted = Path("/workspace/extra/perf-policy/PERF_POLICY.json")
    parser.add_argument("--policy", type=Path, default=mounted if mounted.exists() else HERE / "PERF_POLICY.json")
    parser.add_argument("--state-dir", type=Path, default=Path("/workspace/agent/memory/perf-deliveries"))
    parser.add_argument("--inbound", default="/workspace/inbound.db")
    parser.add_argument("--outbound", default="/workspace/outbound.db")
    args = parser.parse_args(argv)
    if args.run_id <= 0:
        parser.error("run-id must be positive")
    if args.command == "prepare" and (not args.created_at or not args.report):
        parser.error("prepare requires --created-at and --report")
    try:
        args.state_dir.mkdir(parents=True, exist_ok=True)
        # Serialize the reservation across sessions sharing this group workspace.
        with (args.state_dir / f"{args.run_id}.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            if args.command == "prepare":
                result = prepare(args.state_dir, args.run_id, args.created_at, args.report,
                                 json.loads(args.policy.read_text()), args.inbound, args.outbound, Slack())
            else:
                path = args.state_dir / f"{args.run_id}.json"
                state = reconcile(json.loads(path.read_text()), args.inbound, args.outbound)
                save(path, state)
                result = public_status(state)
        print(json.dumps(result))
        return 0
    except (OSError, ValueError, sqlite3.Error) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
