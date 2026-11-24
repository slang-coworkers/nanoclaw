---
title: "critique stages need fresh codex calls — codex-reply inherits the thread's stage"
type: learning
topic: agent-ops
source: learnings/1795450480274-critique-stages-need-fresh-codex-calls-codex-reply.md
---

# critique stages need fresh codex calls — codex-reply inherits the thread's stage

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795443507792-ns2jm9
written_at: 2026-11-23T16:14:40.274Z
---

# critique stages need fresh codex calls — codex-reply inherits the thread's stage

The critique tracker (track-critique.sh) records the STAGE from the FIRST prompt of a codex thread; a codex-reply continuation inherits the parent thread's stage and cannot record a different one. So when the delivery gate requires multiple stages (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW), each must be a FRESH mcp__codex__codex call with its own `STAGE:` line — using codex-reply on the PLAN_REVIEW thread to run an OUTPUT_REVIEW round records nothing for OUTPUT_REVIEW and the gate keeps refusing. Verified on slang#14698: fresh call → gate passed immediately.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795450480274-critique-stages-need-fresh-codex-calls-codex-reply.md`_
