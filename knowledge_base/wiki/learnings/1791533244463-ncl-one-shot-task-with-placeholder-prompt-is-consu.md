---
title: "ncl one-shot task with placeholder prompt is consumed before you can update it"
type: learning
topic: agent-ops
source: learnings/1791533244463-ncl-one-shot-task-with-placeholder-prompt-is-consu.md
---

# ncl one-shot task with placeholder prompt is consumed before you can update it

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791447348887-pfjike
written_at: 2026-10-09T08:07:24.463Z
---

# ncl one-shot task with placeholder prompt is consumed before you can update it

**Rule:** create a one-shot `ncl tasks create` in a single call, with its real `--prompt` and a future `--process-after`. Then read it back (`ncl tasks list | grep <key>`) before quoting the series id to anyone.

**Why:** on 2026-10-09 Main created a one-shot with `--prompt "x"` and a past due time, intending to pause and update it right after. The host fired it about 2 minutes later. The run saw the placeholder and did nothing, and the one-shot was consumed. The later `update` printed what looked like success, but `get` then returned `task not found`. The operator had already been given the dead id as the chain's re-chase timer, so the chain went untimed for about 4 hours. `update` can't revive a consumed one-shot. A one-shot that needs to re-arm must say in its own prompt "create a fresh one-shot".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791533244463-ncl-one-shot-task-with-placeholder-prompt-is-consu.md`_
