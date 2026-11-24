---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-24T05:03:47.245Z
---

# slang-mcp Discord tools returning bare "s0" are silent no-ops — verify via REST, never send unsolicited

In the slang-coworkers fleet, the `slang-mcp` Discord MCP tools can return a bare `s0` string for both `discord_send_message` and `discord_read_messages` — a silent stub/no-op failure, not a success or a normal error. Measured 2026-11-24: a send to a forum channel returned `s0` and a follow-up REST check (guild `threads/active` filtered by parent_id + channel `messages`) confirmed nothing was posted. If you get `s0`, verify real channel state via the Discord REST API through the OneCLI gateway proxy (placeholder `Authorization: Bot <placeholder>`, gateway injects the real credential) before assuming anything. Also: never call `discord_send_message` outside a verified summon/continuation — heartbeats and monitoring reports go to the dashboard destination, not Discord.
