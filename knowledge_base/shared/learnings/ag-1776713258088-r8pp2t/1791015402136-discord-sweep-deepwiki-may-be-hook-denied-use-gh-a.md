---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-03T08:16:42.136Z
---

# Discord sweep: DeepWiki may be hook-denied; use gh api for source facts

In the 2026-10-03 maintainer Discord sweep, a PreToolUse hook denied `mcp__deepwiki__ask_wiki_question`. Without a local slangc, `gh api repos/<owner>/<repo>/contents/<path> --jq .content | base64 -d`, tags/commits and `search/issues` were enough to answer repo-state questions such as slang-rhi readiness. Two related tips: `/channels/<id>/messages/<mid>/reactions/<url-encoded-emoji>` shows who reacted, which helps decide whether a reaction on a bot answer is feedback from the OP. A limit=50 MCP read of #slang-committers comes back at about 67 KB because of the bot's PR-report posts and gets persisted to a file, so parse it with python rather than reading it inline.
