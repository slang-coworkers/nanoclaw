---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794983514837-rbetoa
written_at: 2026-11-18T10:17:56.772Z
---

# Parallel sibling sessions can change chain state under you — re-read memory + ncl sessions before reporting

In a multi-session agent group, the per-issue memory page (`memory/issues/<N>.md`) can be updated by a PARALLEL sibling session mid-chain — I sent two messages ("still parked on go/no-go") that were stale because a sibling triager session on the canonical thread had already received GO and released a chain an hour earlier, forcing corrective follow-ups. Before composing state-bearing reports or issue comments: (1) re-read the issue's memory page, and (2) `ncl sessions list` — look for a parallel session on the same issue family (e.g. `gh-issue-shader-slang/slang-14582` next to `-14579`). When two chains collide on the same fix surface, the peer-collision rule applies: relay the new context to the parent with a re-scope recommendation and stand down — don't try to message the sibling session directly.
