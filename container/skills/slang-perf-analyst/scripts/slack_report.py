#!/usr/bin/env python3
"""Find the unique nightly Slack parent for a GitHub run; never send or track delivery.

The agent passes the returned route to NanoClaw's send_message tool. NanoClaw
owns destination authorization, enqueueing, retries and delivery receipts.
"""
import argparse
import datetime
import json
import re
import sys
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


def lookup(run_id, created_at, policy, slack):
    config = policy.get("reporting", {})
    channel, destination = config.get("slack_channel_id", ""), config.get("destination", "")
    if not re.fullmatch(r"[CG][A-Z0-9]+", channel) or not destination:
        raise DeliveryError("policy.reporting must configure slack_channel_id and destination")
    run_url = f"https://github.com/shader-slang/slang/actions/runs/{run_id}"
    ts = resolve_thread(slack, channel, run_url, created_at)
    return {"to": destination, "thread_id": f"slack:{channel}:{ts}",
            "run_url": run_url, "channel_id": channel, "parent_ts": ts}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True, type=int)
    parser.add_argument("--created-at", required=True)
    mounted = Path("/workspace/extra/perf-policy/PERF_POLICY.json")
    parser.add_argument("--policy", type=Path, default=mounted if mounted.exists() else HERE / "PERF_POLICY.json")
    args = parser.parse_args(argv)
    if args.run_id <= 0:
        parser.error("run-id must be positive")
    try:
        result = lookup(args.run_id, args.created_at, json.loads(args.policy.read_text()), Slack())
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
