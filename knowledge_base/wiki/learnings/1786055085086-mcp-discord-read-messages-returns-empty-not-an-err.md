---
title: "MCP discord_read_messages returns empty (not an error) on forum parents — enumerate threads via the gateway"
type: learning
topic: agent-ops
source: learnings/1786055085086-mcp-discord-read-messages-returns-empty-not-an-err.md
---

# MCP discord_read_messages returns empty (not an error) on forum parents — enumerate threads via the gateway

## TL;DR
`mcp__slang-mcp__discord_read_messages` on a **forum** channel (`type=15`) returns `{"messages": [], "total_count": 0}` with **no error field**. That result is byte-identical to "the channel is quiet", but it actually means "forums hold content in threads and this tool cannot see them." Never report a forum parent as quiet from the MCP tool alone.

## Which Slang channels are forums
Verified via `GET /channels/{id}` → `.type`:
- `1313936640661524601` #slang-support — **type=15 forum**
- `1337094433816051813` #slangpy-support — **type=15 forum**
- `1494023079666647200` #slang-support-bot — **type=15 forum**
- `1305995870046650368` #slang-discussion, `1303735244108595330` #slang-dev, `1451325535635505183` #slangpy-discussion — type=0 text (MCP reads these fine)

So **3 of the 6 monitored channels always come back empty from MCP**, and they are the three that carry the actual support load.

## The working enumeration path (read-only)
Same path the authoritative precheck uses (`ncl tasks get task-1783463591538-d3s5gm`): plain `curl` to the Discord REST API **with the proxy env left intact and no `Authorization` header** — the OneCLI gateway injects the vault "Discord Bot" secret.

```bash
UA="User-Agent: curl/8.0"
GUILD=1303735196696445038
curl -s -H "$UA" "https://discord.com/api/v10/users/@me"                      # auth probe -> 200 SlangMaintainerBot
curl -s -H "$UA" "https://discord.com/api/v10/guilds/$GUILD/threads/active"   # 33 threads, grouped by parent_id
curl -s -H "$UA" "https://discord.com/api/v10/channels/$ID/threads/archived/public?limit=10"
```

Archived threads need the separate `/threads/archived/public` call — `/threads/active` omits them, so a forum post created and archived inside your window is invisible without it.

## Cutoff filtering: use `?after=<snowflake>`, don't eyeball timestamps
Convert a wall-clock cutoff to a snowflake and let Discord do the filtering — it's exact and it makes "0 results" a real measurement rather than a parsing artifact:

```bash
MS=$(( $(date -u -d "2026-08-06T17:03:00Z" +%s) * 1000 ))
SF=$(( (MS - 1420070400000) << 22 ))
curl -s -H "$UA" ".../channels/$ID/messages?after=$SF&limit=50"
# reverse (snowflake -> ms):  ms = (id >> 22) + 1420070400000
```
Decoding `last_message_id` per thread is a cheap pre-filter (one call for all 33 threads) before spending a request per thread.

## Discriminating "clean" from "unread"
Capture the **HTTP status per call** and assert it, so an error can never be tallied as a zero. A per-thread sweep that reports "0 hits" is only meaningful if every call in it returned 200 — otherwise you've measured your own failure rate. This is the *exhaustion-looks-like-success* family: the stopping condition (no rows came back) and the success condition (nothing was there) are the same bytes unless you instrument the difference.

## Side observation
`/threads/active` also revealed `1317234427235139655` = **#showcase**, a forum with active threads that is **not in the monitored channel list** in CLAUDE.md.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786055085086-mcp-discord-read-messages-returns-empty-not-an-err.md`_
