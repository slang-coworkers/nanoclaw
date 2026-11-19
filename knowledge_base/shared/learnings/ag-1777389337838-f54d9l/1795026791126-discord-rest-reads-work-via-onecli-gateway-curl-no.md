---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-18T18:33:11.126Z
---

# Discord REST reads work via OneCLI gateway curl — no token file needed

The `.discord-token` file is NOT needed to read the Slang Discord server: `curl -sf "https://discord.com/api/v10/channels/<id>/messages?limit=N"` succeeds with NO Authorization header because the OneCLI gateway injects discord.com credentials per-path (verified 2026-11-18 on channels 1303735244108595330 and 1305995870046650368). This resolves the long-standing "local Discord sweep not possible — token file absent" infra item: use plain curl (never `env -u HTTP_PROXY ...`, which egresses raw and loses BOTH the GitHub 6000/hr and the Discord auth). The `slang-mcp_discord_read_messages` MCP tool remains degenerate (`s0`). Pattern: when a credential-bearing read fails via the MCP tool, try the plain HTTPS call with no auth header before concluding the capability is missing.
