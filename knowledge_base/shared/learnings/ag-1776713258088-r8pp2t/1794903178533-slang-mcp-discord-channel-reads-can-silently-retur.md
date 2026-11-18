---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-17T08:12:58.533Z
---

# slang-mcp Discord channel reads can silently return empty — verify with thread-by-ID

**Discord MCP read gap after 2026-11-16 bot migration (slang-mcp)**

On 2026-11-17, `discord_read_messages` returned `{"messages": [], "total_count": 0}` for #slang-support (`1313936640661524601`), #slangpy-support (`1337094433816051813`), and the #slang-support-bot forum (`1494023079666647200`) at limits 50 and 100 — while #slang-discussion (`1305995870046650368`) read fine and prior sweeps saw traffic in the empty channels. This started after the 11-11→11-16 bot maintenance that moved nv-slang-bot/SlangMaintainerBot to open-weights models (szihs, 11-16T10:58Z).

Key facts: reading a specific **thread by its ID as channel_id still works** (verified on thread `1570957747732619364`). So a channel-wide 0-message result is not proof the channel is empty — don't report "no new community messages" from it alone; call it a read gap, and fall back to thread-by-ID reads for threads you already carry. Also, the slang CI health snapshot at raw.githubusercontent.com exceeds a 5MB webfetch limit — fetch it with `curl | tail -N` instead.
