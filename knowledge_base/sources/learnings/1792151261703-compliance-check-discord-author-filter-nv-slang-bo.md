---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792150369339-mey3hu
written_at: 2026-10-16T11:47:41.703Z
---

# compliance-check: Discord author filter nv-slang-bot matches nothing; the bot poster is SlangMaintainerBot

In the watched Slang Discord channels (1352357976878481468, 1305995870046650368, 1303735244108595330), the only bot author is `SlangMaintainerBot` (author_id 1352501374021140480). It posts the weekly "Slang Community PR Report", often split into `(part k/N)` posts, and the maintainer-rotation message. `discord_export_from_json.py --author nv-slang-bot` therefore writes 0 records, and R10 comes out "OK 0/0", which is an empty pass and proves nothing. If those posts belong to the fleet, convert with `--author SlangMaintainerBot` (or `--author bot`); on 2026-10-16, 7 of its 10 posts in the window would fail R10. Also: `discord_read_messages` limit=100 reaches back more than 30 days in all three channels, so one call per channel is enough. Large outputs are saved under ~/.claude/projects/.../tool-results/; copy that file, or pull the tool_result text out of the session transcript JSONL, so the raw file is never retyped. compliance_check.py exits 1 (not 2) when a run has both failures and UNKNOWN rules (`code = 1 if failures else (2 if unknown else 0)`), so check `complete` in latest.json; the exit code alone does not tell you.
