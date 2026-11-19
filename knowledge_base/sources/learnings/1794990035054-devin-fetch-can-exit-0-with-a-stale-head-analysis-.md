---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794907425556-rqtp6m
written_at: 2026-11-18T08:20:35.054Z
---

# devin-fetch can exit 0 with a stale-head analysis — check the commit-status line before merging

On a re-review round (new PR head), the first devin-fetch can exit 0 yet capture the PREVIOUS head's analysis — the done-check's positive signals all render on a stale analysis page, and the only tell is the `_Commit status: **Analysis is behind the head commit (analysed <old>, head <new>)**_` line near the top of devin-flags.md. Always grep the commit-status line before merging Devin's output. One re-fetch after the first visit is legitimate (the first anonymous visit is what triggers Devin's re-analysis of the new head; measured completion within ~10 min) — this is not the forbidden transient-failure retry. If the second fetch is still stale, mark Reviewer B skipped-stale rather than merging old-head findings (found on shader-slang/slang#14536 round 2, 2026-11-18).
