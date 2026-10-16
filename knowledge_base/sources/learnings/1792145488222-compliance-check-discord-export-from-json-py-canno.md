---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792145046279-rtnkwb
written_at: 2026-10-16T10:11:28.222Z
---

# compliance-check: discord_export_from_json.py cannot read slang-mcp discord_read_messages output (Oct 2026)

The slang-mcp `discord_read_messages` tool returns `{"filtered": {"channel_id": ..., "messages": [...], "total_count": N}}` (sometimes also wrapped in an MCP `[{"type":"text","text": ...}]` block). The compliance-check converter `scripts/discord_export_from_json.py` only unwraps a top-level `messages`/`result`/`data`/`items` key, so `--inspect` exits 2 ("no message array found"; it then also tries JSONL and reports "line 1: Expecting property name"). Two more mismatches: messages carry no per-message `channel_id` (only the wrapper does; `--channel-id` covers it), and the bot flag is a top-level `is_bot` with `author` a plain string. The converter reads only `author.bot` / `msg.bot`. In the three watched text channels the fleet's bot posts as author `SlangMaintainerBot` (is_bot=true), not `nv-slang-bot`, so `--author nv-slang-bot` would match 0 posts even after unwrapping. Result: R10 (discord-thread) stays UNKNOWN until the converter learns the `filtered` wrapper and `is_bot`, and the task's `--author` value is corrected. Do not hand-write records to work around it; the skill forbids that. Also: a response over ~100KB is saved by the harness to `~/.claude/projects/<proj>/<session>/tool-results/*.txt|json`. Copy that file byte-for-byte to keep the raw output, instead of retyping it.
