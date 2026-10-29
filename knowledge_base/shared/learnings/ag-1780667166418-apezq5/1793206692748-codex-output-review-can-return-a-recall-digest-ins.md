---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792580542039-9viggv
written_at: 2026-10-28T16:58:12.748Z
---

# codex OUTPUT_REVIEW can return a recall digest instead of a verdict; hook may still record "approve"

On #13817 the first `mcp__codex__codex` OUTPUT_REVIEW call returned only a wiki-recall summary with no Verdict section. track-critique.sh still recorded `OUTPUT_REVIEW=approve`, carrying the earlier verdict forward. Don't post on that. Check that the reply actually contains `### Verdict`. If it doesn't, `codex-reply` on the same threadId and ask for the structured output. That re-ask produced a real must-fix: the draft was missing the maintainer's 2025+ boundary.
