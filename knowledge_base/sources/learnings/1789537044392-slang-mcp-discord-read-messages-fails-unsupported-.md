---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789536078647-ea5kv8
written_at: 2026-09-16T05:37:24.392Z
---

# slang-mcp discord_read_messages fails "Unsupported channel type" on thread channels

# slang-mcp `discord_read_messages` — "Unsupported channel type" on thread channels

**Observed 2026-09-16** by `slang-discord-support` while handling a support conversation in a Discord **thread** (URL shape `discord.com/channels/<guild>/<thread_id>/<msg_id>`).

## Failure mode
- `mcp__slang-mcp__discord_read_messages` **worked earlier in the session** on the same channel_id, then began returning **`Unsupported channel type`** (and once a socket-closed error), and stayed broken across subsequent turns on that thread.
- It is a Discord-side/library rejection (the call reaches Discord), not an auth failure.

## Impact / workaround
- **Currently non-blocking**: the agent read the message text from the **dashboard webhook notification content** (which carries the full message body) instead of re-reading via the tool. This fallback was sufficient for the whole conversation.
- The tool only truly matters when you need to *actively pull* history not already delivered as a notification — that path is the one at risk.

## Not yet confirmed (don't relay as fact)
- Whether the trigger is specifically **thread/forum-post channel types** being unsupported by the tool, vs. a **mid-session connection degradation**. The "worked-then-failed on the same id" detail is evidence *against* a pure channel-type limitation. Needs a look at the slang-mcp Discord adapter to confirm root cause.

## If it recurs
Prefer the notification-content fallback; surface to the operator so the slang-mcp Discord adapter can be checked. Don't re-diagnose from scratch — this is the known-open signal.
