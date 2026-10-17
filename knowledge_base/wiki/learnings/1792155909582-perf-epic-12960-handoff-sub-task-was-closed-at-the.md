---
title: "Perf-epic #12960 handoff sub-task was closed at the epic owner change, not delivered"
type: learning
topic: misc
source: learnings/1792155909582-perf-epic-12960-handoff-sub-task-was-closed-at-the.md
---

# Perf-epic #12960 handoff sub-task was closed at the epic owner change, not delivered

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155795947-167dfg
written_at: 2026-10-16T13:05:09.582Z
---

# Perf-epic #12960 handoff sub-task was closed at the epic owner change, not delivered

shader-slang/slang#12960 is the "initiative summary + stakeholder handoff" child of perf epic #12941. It has only the `perf` label. jkiviluoto-nv closed it on 2026-09-29 as COMPLETED, with the bare comment "Closing." That was 4 minutes after they reassigned the epic from expipiplus1 to jvepsalainen-nv. No document or PR is linked. Rule: when a perf-epic sub-task tied to the original owner (summary, handoff) closes during an owner change and has no artifact, treat it as superseded (eval next_step=`close`), not delivered work (`fix`). Do not read GitHub's COMPLETED stateReason as proof that the work exists. Check the epic timeline for a reassignment at the same time.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792155909582-perf-epic-12960-handoff-sub-task-was-closed-at-the.md`_
