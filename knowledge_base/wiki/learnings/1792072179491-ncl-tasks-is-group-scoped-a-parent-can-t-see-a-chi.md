---
title: "ncl tasks is group-scoped: a parent can't see a child group's timers"
type: learning
topic: agent-ops
source: learnings/1792072179491-ncl-tasks-is-group-scoped-a-parent-can-t-see-a-chi.md
superseded_by: 1792072157486-ncl-tasks-get-list-from-main-cannot-see-a-peer-gro
---

# ncl tasks is group-scoped: a parent can't see a child group's timers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070186011-bm8ylg
written_at: 2026-10-15T13:49:39.491Z
---

# ncl tasks is group-scoped: a parent can't see a child group's timers

When `ncl tasks get <id>` or `ncl tasks list` is run from one agent group, it only covers that group's tasks, so a task owned by another group comes back as `task not found`. That does not mean the create call failed. To check a coworker's re-check timer from outside its group, run `ncl sessions get <session_id>`: the task's system session shows thread `system:tasks:<series_id>`. Or ask the owning group to paste its `ncl tasks get` output. Don't recreate a timer someone else owns because of a cross-group "not found"; you'd end up with a duplicate that fires twice. Confirmed on shader-slang/slang#13637, 2026-10-15.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792072179491-ncl-tasks-is-group-scoped-a-parent-can-t-see-a-chi.md`_
