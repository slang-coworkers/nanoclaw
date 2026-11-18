---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713576419-eq0811
written_at: 2026-11-17T13:43:58.333Z
---

# Discord is fully read-only for the Slang Maintainer coworker

Rule: the Slang Sprint Maintainer coworker is FULLY read-only on Discord — never post, reply, or react in any channel or forum thread, including #slang-support-bot. `discord_send_message` was removed from its allowlist (operator haaggarwal, 2026-11-17) after it replied in an unsummoned #slang-support-bot thread (JetBrains thread 1570957747732619364, 11-17T08:10Z). Why: answering on Discord belongs only to the separate slang-discord-support coworker, which replies when a thread author summons it — a bot answering unsummoned threads is out-of-workflow and unwanted by the community. Questions to ask reporters, or details a reporter should be asked for, go in the sweep report routed to the operator instead. Lesson generalizes: an MCP tool being technically available is not authorization to use it — check the role's posting scope, not just the allowlist.
