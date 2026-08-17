---
title: "Discord forum channels return 0 from /messages — read threads instead (4-day false-empty)"
type: learning
topic: misc
source: learnings/1785917748422-discord-forum-channels-return-0-from-messages-read.md
---

# Discord forum channels return 0 from /messages — read threads instead (4-day false-empty)

## The bug this kills

For **4 consecutive days** (2026-08-02 → 08-05) the Slang maintainer daily report stated
`#slang-support`, `#slangpy-support`, and `#slang-support-bot` were "empty", and escalated it as a
suspected **bot read-permission gap** needing a human spot-check. That diagnosis was wrong. There was
never a permissions problem — **16 live `#slang-support` threads were invisible the whole time.**

## Root cause

Those three channels are **Discord forum channels (`type: 15`)**, not text channels (`type: 0`).

A forum channel has **no messages of its own** — every post is a *thread* whose `parent_id` is the
forum. So `GET /channels/{id}/messages` correctly returns `[]` with **HTTP 200**. It is not an error,
not a permission denial, and not empty content. `mcp__slang-mcp__discord_read_messages` wraps that
same endpoint, so it reports `total_count: 0` too.

**HTTP 200 + `[]` on a forum is indistinguishable from a genuinely quiet text channel unless you
check the channel type.** That is why it survived four daily reports and a corroboration pass: I
re-ran the *same shape of call* on a second path (MCP → direct REST), both returned 0, and I read
that agreement as confirmation. Two paths hitting the same wrong endpoint corroborate each other
perfectly.

## How to read a forum channel

```bash
# 1. Identify the channel type first — 15 = forum, 0 = text
curl -H "Authorization: Bot $TOK" .../v10/channels/$CID | jq .type

# 2. Forum posts are threads. Guild-wide active threads, one call, all forums at once:
curl -H "Authorization: Bot $TOK" .../v10/guilds/$GUILD_ID/threads/active
#    -> filter by .threads[].parent_id == your forum's id

# 3. Archived (older) posts need a separate call, per forum:
curl -H "Authorization: Bot $TOK" .../v10/channels/$CID/threads/archived/public?limit=20

# 4. THEN read each thread id as if it were a channel — this works with the MCP tool:
#    discord_read_messages(channel_id=<thread_id>)
```

Sort threads by recency **from the snowflake** (`last_message_id`), not by list order:
`ts_ms = (int(snowflake) >> 22) + 1420070400000`. The active-threads response has no timestamp field.

`message_count` on a thread excludes the root post. `/threads/active` is guild-scoped and covers
every forum in one request — cheaper than per-channel polling.

## Transferable lesson

**Corroborating a suspicious empty result only works if the second path differs in *kind*, not just
in client.** MCP-vs-curl is the same endpoint twice. When a read returns "nothing" and something
feels off, the question to ask is not "did another client agree?" but **"am I querying the right
kind of object at all?"** Check the resource's own type/shape metadata before believing its
emptiness — and before escalating a nonexistent infrastructure problem to a human.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785917748422-discord-forum-channels-return-0-from-messages-read.md`_
