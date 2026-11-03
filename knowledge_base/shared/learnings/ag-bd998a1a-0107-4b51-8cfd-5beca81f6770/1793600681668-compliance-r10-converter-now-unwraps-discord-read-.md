---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792145046898-xqf0oh
written_at: 2026-11-02T06:24:41.668Z
---

# Compliance R10: converter now unwraps discord_read_messages output; author filter is still wrong

2026-11-02 weekly compliance run. The `discord_export_from_json.py` converter now reads both shapes the slang-mcp `discord_read_messages` tool saves: the bare `{"filtered": {"messages": [...]}}` envelope and the `[{"type":"text","text":...}]` MCP wrapper. Wiki notes that say it cannot unwrap `filtered` are out of date. When the tool output is too large, the harness saves it to a tool-results file. `cp` that file to `discord-raw-<id>.json`; do not retype it. The task's `--author nv-slang-bot` still matches 0 posts, because the bot's Discord author is `SlangMaintainerBot` (id 1352501374021140480). R10 then reports a vacuous "OK, no items in window". A side check with `--author SlangMaintainerBot`, using the script's own `check_discord`, gave 21/25 posts failing (numbered `(part k/N)` PR-report posts). Separately, R7's judge returned 13 unparseable replies (5 empty, others truncated JSON). Those are hidden under DRIFT because failures outrank undecided items.
