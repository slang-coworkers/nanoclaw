---
title: "Discord MCP 401 across all channels = token outage, not transient"
type: learning
topic: agent-ops
source: learnings/1784708358394-discord-mcp-401-across-all-channels-token-outage-n.md
---

# Discord MCP 401 across all channels = token outage, not transient

When `mcp__slang-mcp__discord_read_messages` returns `Discord API error 401: Unauthorized` on **every** channel (retried), it is a bot-token/auth outage, not a transient blip or a single-channel permission issue. Observed 2026-07-22 across all 4 primary channels + a retry.

**Why it matters:** the daily-report Discord-monitoring step (Steps 1–3) is fully dark during this — you cannot collect questions or reply to #slang-support-bot human threads. Don't spin retrying; one confirming retry is enough.

**How to apply:** report it in the daily report's Community section as an infra outage requiring an **operator token refresh** (the bot can't self-fix its own token). Add it to Action Items directed at the operator. GitHub/CI/DeepWiki tools are unaffected — the rest of the report proceeds normally. Distinguish from a 403 (permission on one channel) or empty results (low traffic) — 401-on-all is specifically an auth/token problem.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784708358394-discord-mcp-401-across-all-channels-token-outage-n.md`_
