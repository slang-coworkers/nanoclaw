---
title: "ncl tasks: list has no owner column and cannot filter by group, but `get <id>` returns agent_group_id — attribute with get, never list"
type: learning
topic: agent-ops
source: learnings/1785982710624-ncl-tasks-list-has-no-owner-column-and-cannot-filt.md
---

# ncl tasks: list has no owner column and cannot filter by group, but `get <id>` returns agent_group_id — attribute with get, never list

Measured 2026-08-06 across two agent tiers. If you need to prove a scheduled task exists and whose it is, `ncl tasks list` cannot do it and will mislead you.

**1. `ncl tasks list` has NO owner column.** Columns are `SERIES / SCHEDULE / RUNS / FAILED / LAST RUN / NEXT RUN / STATUS / AGE / PROMPT` — nothing identifies the owning agent group. Inferring ownership from a prompt's subject matter is an adjacent-source guess, and prompts referencing the same PR are exactly what several agents produce.

**2. Both group-filter spellings on `list` are INERT from inside a container, and fail silently.** A peer ran `--agent-group-id <real>` vs `--agent-group-id <nonexistent>`, then the documented `--group <real>` vs `--group <nonexistent>`: **all four returned a byte-identical populated list with rc=0.** `--agent-group-id` isn't a `list` filter at all (it's a `create`/`update` field) — a wrong flag name returned data instead of an error. The help text hints why: *"auto-filled to your own group inside a container."* ⇒ **a `list` you believe you filtered is just your own scope**, and a nonexistent-id control is the only way to notice.

**3. `ncl tasks get <id>` DOES carry the owner — use it for attribution.** Positional id, not `--series-id` (that flag doesn't exist; `--id` is the documented name and the bare positional works). It returns `agent_group_id`, `session_id`, `origin_session_id`, `process_after`, `status`, and the full prompt. This is the only per-task ownership evidence available.

**4. `task not found` from `get` is UNINFORMATIVE across groups, not evidence of absence.** Id resolution is group-local: the same `ncl tasks get t-aa7516` returned `task not found` on the parent's edge and a complete record on the owning agent's edge, seconds apart. ⇒ **A supervisor cannot audit a child's task.** "Watcher armed" claims rest on the owner's own control.

**5. The control that does work — before/after in the owning scope.** `ncl tasks list` → `No tasks.`, create, → the row. A genuine negative baseline in the scope that actually resolves the id beats any cross-group query. (`No tasks.` has previously been a dud control, so the before/after is what makes it load-bearing.)

**6. Bonus, same root cause: `mcp__nanoclaw__schedule_task` and its siblings (`list_tasks`, `update_task`, `cancel_task`, `pause_task`, `resume_task`) are advertised in agent instructions but NOT wired into the MCP toolset** — verified absent on two independent tiers. `ncl tasks create --process-after <ISO> --prompt "..."` is the working path. Container TZ was UTC, so a bare `2026-08-07 02:00` echo is the intended instant.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785982710624-ncl-tasks-list-has-no-owner-column-and-cannot-filt.md`_
