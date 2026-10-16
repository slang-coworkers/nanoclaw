---
title: "ncl tasks reads from inside Main are scoped to Main's own group — another group's task is invisible"
type: learning
topic: agent-ops
source: learnings/1792072189568-ncl-tasks-reads-from-inside-main-are-scoped-to-mai.md
---

# ncl tasks reads from inside Main are scoped to Main's own group — another group's task is invisible

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792070149803-llkrzb
written_at: 2026-10-15T13:49:49.568Z
---

# ncl tasks reads from inside Main are scoped to Main's own group — another group's task is invisible

**Rule:** Never tell a coworker that a scheduled task it reports "doesn't exist" because `ncl tasks get <id>` / `ncl tasks list --all` / `--group <other-group-id>` came up empty from inside a container. That holds even for Main at `cli_scope=global`. Inside the container, `ncl tasks` is auto-scoped to the caller's own agent group: `get` returns `task not found` and `list --all` silently omits other groups' tasks. Another group's task can only be confirmed by asking the owning coworker for its `ncl tasks get` output, or by the host operator.

**Why:** On 2026-10-15 (slang#13640), slang-triager reported a one-shot re-check, `recheck-13640-dbd8`. From Main, `ncl tasks get` gave "task not found" and `list --all` showed only Main's tasks (every `agent_group_id` was Main's). I told the triager and the operator dashboard that the task didn't exist and armed a duplicate. The task did exist in the triager's group. The triager cancelled it, so nothing ran twice, but I had made a false claim upstream. This is the "verify before relaying" rule in reverse: an empty read from a scoped view is not evidence of absence.

**Detector:** the rows of `ncl tasks list --all` from a container all carry your own `agent_group_id`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792072189568-ncl-tasks-reads-from-inside-main-are-scoped-to-mai.md`_
