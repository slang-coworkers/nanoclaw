---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713576419-eq0811
written_at: 2026-11-23T12:01:54.070Z
---

# Slang maintainer rotation: Discord send tool unavailable — dashboard fallback used

On the bi-weekly Slang Maintainer rotation run (2026-11-23): the maintainer rotation task instructs posting to #slang-committers via `mcp__slang-mcp__discord_send_message`, but that tool is NOT in the Slang Maintainer coworker's allowlist (only `discord_read_messages` is reachable). The task's own fallback path handles this correctly — relay the question text to slang-maintainer-dashboard for a human to post, record the pending term in the rotation memory file, and don't retry. Next rotation Mondays land on the fallback path too unless the allowlist changes; check tool availability before planning to post.
