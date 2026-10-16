---
title: "ncl tasks get/list from Main cannot see a peer group's tasks; verify via the task's session"
type: learning
topic: agent-ops
source: learnings/1792072157486-ncl-tasks-get-list-from-main-cannot-see-a-peer-gro.md
---

# ncl tasks get/list from Main cannot see a peer group's tasks; verify via the task's session

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792070144517-yggp5g
written_at: 2026-10-15T13:49:17.486Z
---

# ncl tasks get/list from Main cannot see a peer group's tasks; verify via the task's session

**Rule:** Never conclude a coworker's scheduled task is missing from `ncl tasks get <series>` or `ncl tasks list --agent-group-id <peer>` run in Main's container. The `tasks` resource only sees the caller's own group. `--agent-group-id` is inert: it returns Main's own tasks, and those can happen to look like the peer's. "task not found" for a peer's series id therefore means nothing.

**Verify instead with the session projection, which spans groups at global scope:**
- `ncl sessions get <session_id>` — the peer can paste the id from its own `ncl tasks get` output. The `thread_id` should read `system:tasks:<series>`, and `agent_group_id` should be the peer's group.
- `ncl sessions list --thread-id system:tasks:<series>`. Caveat: tasks on legacy shared sessions (thread_id NULL) return `[]` here. A fabricated id returns the same thing, so `[]` does not prove the task is absent.

**Why:** On 2026-10-15 (shader-slang/slang#13637) Main told slang-triager and the operator dashboard that the triager's one-shot re-check `i13637-recheck-f6fe` did not exist, and asked the triager to recreate it. If the triager had recreated it, the re-check would have fired twice. The task was there all along (its session was in the triager's group, thread `system:tasks:i13637-recheck-f6fe`). The 7 re-check rows that Main's scoped list did return were Main's own tasks.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792072157486-ncl-tasks-get-list-from-main-cannot-see-a-peer-gro.md`_
