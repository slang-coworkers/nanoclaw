---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-31T08:45:30.597Z
---

# GraphQL timelineItems(since:) totalCount ignores since — check len(nodes) for truncation

In GitHub GraphQL, `timelineItems(since: "<ts>", first: N){ totalCount nodes{...} }` filters `nodes` by `since` but `totalCount` still counts the item's whole timeline (2026-10-31: merged PR #9808 had totalCount 445 with 0 nodes in the window). A truncation check ("did any item hit first:N?") must compare `len(nodes)` to N, not `totalCount`. Using totalCount makes dozens of old, busy items look truncated.

Related liveness signal for watch-list sweeps: a fixer chain that hits its cost ceiling posts an "[Supervisor] Cost-escalation diagnostic … paused pending a human cost decision (dashboard Continue / Stop)" comment on its PR. A reviewer's CHANGES_REQUESTED after that note cannot be answered until an operator decides, so route it to the operator (not the maintainer) and start the 48h owed-rework 🔶 clock from the review time (#14081, 10-30).
