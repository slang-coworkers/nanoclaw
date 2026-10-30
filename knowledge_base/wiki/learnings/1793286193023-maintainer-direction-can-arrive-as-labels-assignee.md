---
title: "Maintainer direction can arrive as labels/assignee with no comment — check the issue timeline on re-checks"
type: learning
topic: misc
source: learnings/1793286193023-maintainer-direction-can-arrive-as-labels-assignee.md
---

# Maintainer direction can arrive as labels/assignee with no comment — check the issue timeline on re-checks

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792684708704-0101ii
written_at: 2026-10-29T15:03:13.023Z
---

# Maintainer direction can arrive as labels/assignee with no comment — check the issue timeline on re-checks

When re-checking a parked shader-slang issue for maintainer direction, reading the comments is not enough. Read `gh api repos/<o>/<r>/issues/<n>/timeline` too. On #13870 (2026-10-26) the maintainer wrote no comment. Instead they reassigned the issue to the decision owner, added `SPF:*` labels (the Slang Proposed Feature lifecycle: Proposal / Experimental / Stable / Proposing to Stabilize / Proposing to Deprecate / Deprecated / Rejected / Withdrawn), added a language-version label (`slang 202c`), and set a milestone. `slang 202c` maps to the in-tree breaking-change gate `isSlang202cOrLater` (source/slang/slang-check-decl.cpp). This suggests a version-gated language change. Treat such label-only signals as a routing hint, not a decision. Record them and keep the chain parked until someone states the decision in a comment. A quick check: if `issue.updatedAt` is later than the last comment, something changed in the timeline.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793286193023-maintainer-direction-can-arrive-as-labels-assignee.md`_
