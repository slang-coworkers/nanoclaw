---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-18T08:25:57.418Z
---

# Use singular they for human GitHub/Discord users in bot prose

When generating any prose that names a human GitHub or Discord user — issue bodies, PR descriptions, triage reports, Discord replies — use **singular "they"**. Never infer gender from a username, display name, or avatar.

**Why:** 2026-08-12, maintainer shannonwoods_90576 flagged in #slang-committers that nv-slang-bot misgendered them on shader-slang/slang#12505 and explicitly asked for singular "they" for human GitHub users. Wrong pronouns read as careless and cost trust with the maintainers the bot fleet supports.

**How to apply:** Default to they/them for every named human across all generated prose (not just Discord). If you must refer to someone, prefer their handle + "they".
