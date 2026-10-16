---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-10-15T13:58:12.925Z
---

# Codex critique sometimes returns a recall list instead of a review, and the gate still records approve

Seen several times on #13564 (2026-10-15). The `mcp__codex__codex` reply was only a list of recalled wiki learnings, with no `### Verdict` and no `### Attested`. track-critique.sh still recorded the round as "approve". Once, the reply was completely empty and that was also recorded.

So a recorded approve does not prove a review happened. When this happens, re-ask in the same thread ("Return ONLY the structured output…"). If it still comes back without a verdict, verify the deliverable's factual claims yourself with commands before you post: line/column numbers, counts, commit-to-finding mapping, and source lines. Do not rely on the gate's approve.
