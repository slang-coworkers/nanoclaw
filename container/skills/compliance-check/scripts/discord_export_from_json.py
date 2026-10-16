#!/usr/bin/env python3
"""Convert saved `discord_read_messages` output into the compliance check's JSONL export.

The compliance check scores R10 from one JSON object per bot post (see README.md,
"Discord export"). The agent gets the posts from `mcp__slang-mcp__discord_read_messages`
and saves the tool's output to a file; this helper turns that file into the export so
the agent never hand-writes a record, which is where a field would get mistyped and a
whole week would be scored on a wrong `created_at`.

The tool's output is not under this repository's control, so the reader accepts the
shapes a Discord message listing commonly takes: a JSON array of messages, an object
holding the array under `messages`, `result`, `data` or `items`, an MCP result wrapper
whose `content[].text` holds the JSON, or one JSON object per line. Fields are read
under their Discord names and common aliases (`id`, `channel_id`/`channelId`/`channel.id`,
`timestamp`/`created_at`/`createdAt`, `content`/`text`, `author`, `thread_id`/`thread.id`,
`jump_url`/`url`). Anything the input lacks is given on the command line.

  discord_export_from_json.py --inspect saved.json
  discord_export_from_json.py saved.json --author nv-slang-bot --channel-type text \\
      --channel-id 1352357976878481468 --guild-id 1303735196696445038 >> discord-export.jsonl

Only posts whose author matches `--author` (substring of the author's name or id, or the
author's `bot` flag when `--author bot`) are written; everything else is someone else's
post and is not scored. Exit 0 on success, 1 when a record cannot be converted, 2 when
the input cannot be read. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import sys

ARRAY_KEYS = ("messages", "result", "data", "items")


def unwrap(obj):
    """The list of message objects inside whatever the tool output was saved as."""
    if isinstance(obj, list):
        if obj and all(isinstance(x, dict) and x.get("type") == "text" and "text" in x for x in obj):
            return unwrap_text_blocks(obj)
        return obj
    if isinstance(obj, dict):
        if isinstance(obj.get("content"), list) and all(isinstance(x, dict) and x.get("type") == "text" for x in obj["content"]):
            return unwrap_text_blocks(obj["content"])
        for key in ARRAY_KEYS:
            if isinstance(obj.get(key), list):
                return obj[key]
        if "id" in obj and ("content" in obj or "text" in obj):
            return [obj]
        # The slang-mcp tool wraps its result in a single envelope key, for example
        # `{"filtered": {"channel_id": ..., "messages": [...]}}`; one level of such
        # wrapping is descended before giving up.
        envelopes = [v for v in obj.values() if isinstance(v, (dict, list))]
        if len(envelopes) == 1:
            return unwrap(envelopes[0])
    raise ValueError(f"no message array found (expected a list, or an object with one of {', '.join(ARRAY_KEYS)})")


def unwrap_text_blocks(blocks):
    out = []
    for b in blocks:
        text = b.get("text", "").strip()
        if not text:
            continue
        out.extend(unwrap(json.loads(text)))
    return out


def load_messages(path):
    with open(path, encoding="utf-8") as fh:
        raw = fh.read()
    stripped = raw.strip()
    if not stripped:
        return []
    try:
        return unwrap(json.loads(stripped))
    except ValueError:
        pass
    msgs = []
    for n, line in enumerate(stripped.split("\n"), 1):
        if line.strip():
            try:
                msgs.extend(unwrap(json.loads(line)))
            except ValueError as e:
                raise ValueError(f"line {n}: {e}") from e
    return msgs


def pick(d, *paths):
    """The first present value among dotted paths such as `channel.id`."""
    for p in paths:
        cur = d
        for part in p.split("."):
            if not isinstance(cur, dict) or part not in cur:
                cur = None
                break
            cur = cur[part]
        if cur not in (None, ""):
            return cur
    return None


def author_matches(msg, needle):
    author = msg.get("author")
    if needle == "bot":
        return bool(isinstance(author, dict) and author.get("bot")) or bool(msg.get("bot")) or bool(msg.get("is_bot"))
    if isinstance(author, dict):
        hay = " ".join(str(author.get(k, "")) for k in ("username", "name", "global_name", "id", "login"))
    else:
        hay = str(author or pick(msg, "author_id", "author_name", "user") or "")
    return needle.lower() in hay.lower()


def convert(msg, args):
    """One export record from one message, or a ValueError naming the missing field."""
    mid = pick(msg, "id", "message_id", "messageId")
    channel = pick(msg, "channel_id", "channelId", "channel.id") or args.channel_id
    created = pick(msg, "timestamp", "created_at", "createdAt", "created")
    content = pick(msg, "content", "text", "body")
    if mid is None:
        raise ValueError("message has no id")
    if channel is None:
        raise ValueError(f"message {mid} has no channel id and --channel-id was not given")
    if created is None:
        raise ValueError(f"message {mid} has no timestamp")
    thread = pick(msg, "thread_id", "threadId", "thread.id")
    channel_type = pick(msg, "channel_type", "channelType") or args.channel_type
    if isinstance(channel_type, int):
        # Discord channel type codes: 11/12 are threads, 15 is a forum, 0/5 are text.
        channel_type = "thread" if channel_type in (10, 11, 12) else "forum" if channel_type == 15 else "text"
    url = pick(msg, "jump_url", "jumpUrl", "url")
    guild = pick(msg, "guild_id", "guildId") or args.guild_id
    if not url and guild:
        url = f"https://discord.com/channels/{guild}/{channel}/{mid}"
    rec = {
        "id": str(mid),
        "channel_id": str(channel),
        "channel_type": str(channel_type),
        "thread_id": None if thread in (None, "") else str(thread),
        "created_at": str(created),
        "content": "" if content is None else str(content),
        "coworker": args.coworker,
    }
    if url:
        rec["url"] = url
    return rec


def inspect(msgs):
    keys = {}
    for m in msgs[:50]:
        if isinstance(m, dict):
            for k, v in m.items():
                keys.setdefault(k, type(v).__name__)
    print(f"{len(msgs)} message(s); keys seen in the first 50: " + ", ".join(f"{k}:{t}" for k, t in sorted(keys.items())))
    if msgs:
        print("first message: " + json.dumps(msgs[0], ensure_ascii=False)[:600])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("path", help="file holding the saved tool output")
    ap.add_argument("--author", default="nv-slang-bot", help="keep posts whose author name/id contains this, or `bot` for the bot flag (default nv-slang-bot)")
    ap.add_argument("--channel-id", default=None, help="channel id when the messages do not carry one")
    ap.add_argument("--channel-type", default="text", help="text | forum | thread, when the messages do not say (default text)")
    ap.add_argument("--guild-id", default=None, help="guild id, to build jump URLs when the messages carry none")
    ap.add_argument("--coworker", default="maintainer", help="coworker to attribute the posts to (default maintainer)")
    ap.add_argument("--inspect", action="store_true", help="print the message count and the keys seen, write nothing")
    args = ap.parse_args(argv)
    try:
        msgs = load_messages(args.path)
    except (OSError, ValueError) as e:
        print(f"ERROR: cannot read {args.path}: {e}", file=sys.stderr)
        return 2
    if args.inspect:
        inspect(msgs)
        return 0
    written = 0
    for m in msgs:
        if not isinstance(m, dict) or not author_matches(m, args.author):
            continue
        try:
            rec = convert(m, args)
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 1
        sys.stdout.write(json.dumps(rec, ensure_ascii=False) + "\n")
        written += 1
    print(f"{written} post(s) by {args.author!r} written out of {len(msgs)} message(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
