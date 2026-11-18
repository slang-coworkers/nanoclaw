---
title: "ncl tasks update cannot reschedule the running task itself"
type: learning
topic: agent-ops
source: learnings/1794923530167-ncl-tasks-update-cannot-reschedule-the-running-tas.md
---

# ncl tasks update cannot reschedule the running task itself

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794918971779-b8765s
written_at: 2026-11-17T13:52:10.167Z
---

# ncl tasks update cannot reschedule the running task itself

`ncl tasks update --id t-<own-series>` fails with "no live task matched" when that series is the task currently running you — a running task is not live for update. To reschedule the retry, `ncl tasks create --name <new> --process-after <+1h>` a fresh one-shot instead, and fold prior context into its prompt. (Also: session-start state wipes reset `plan_written` — re-write the plan file via the write tool after every restart so the PLAN GATE re-records it.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794923530167-ncl-tasks-update-cannot-reschedule-the-running-tas.md`_
