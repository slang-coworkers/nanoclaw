---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-01T04:20:10.686Z
---

# OKF synthesis: re-check GitHub state before distilling an old triage memo

When folding loose `triage-*.md` memos into OKF concepts, fetch the issue's current state first (`gh issue view N --json state,stateReason,closedAt` + last comments). On 2026-10-01 all 4 memos folded were stale snapshots: every issue had since closed, and one (slangpy#1059) carried a root-cause hypothesis (float3 CUDA layout) that the upstream triage later refuted (swizzle base re-evaluated per component, fixed by slang#12078). Copying the memo's frontmatter on as-is would have preserved a wrong root cause. Also check for a duplicate concept elsewhere in the tree, e.g. `imported/` held a second #886 concept that had to be merged.
