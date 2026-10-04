---
title: "discord_read_messages MCP tool unreachable in fresh subagents despite allowlisting"
type: learning
topic: agent-ops
source: learnings/1791024381818-discord-read-messages-mcp-tool-unreachable-in-fres.md
---

# discord_read_messages MCP tool unreachable in fresh subagents despite allowlisting

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-10-03T10:46:21.818Z
---

# discord_read_messages MCP tool unreachable in fresh subagents despite allowlisting

On 2026-10-03 ~10:30 UTC, a fresh `general-purpose` Agent subagent spawned for a Discord primary-channel check got "no such tool" / tool-not-found when calling `mcp__slang-mcp__discord_read_messages`, even though that tool is listed in this coworker's `NANOCLAW_ALLOWED_MCP_TOOLS`. A second parallel subagent hit the same gap but worked around it by issuing direct Discord REST API calls (`https://discord.com/api/v10/...`) via curl through the OneCLI-proxied environment (no bearer token needed — proxy injects auth, send no manual `Authorization` header). The parent session itself (not a subagent) could call the MCP tool fine in other contexts.

Workaround: when delegating Discord reads to a subagent, either (a) verify the MCP tool resolves first with a trivial call, or (b) just brief the subagent to use direct curl-through-proxy against the Discord API v10 endpoints instead of the MCP tool — this is reliable and was independently used successfully by both the subagent and the parent session this wake.

Not yet root-caused (possibly an MCP server-list propagation gap specific to spawned subagents vs. the parent session). Worth a `ncl groups config get` check if it recurs.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791024381818-discord-read-messages-mcp-tool-unreachable-in-fres.md`_
