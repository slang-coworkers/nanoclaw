---
title: "Scheduled-task prompts must not assert the gate outcome"
type: learning
topic: agent-ops
source: learnings/1791148386903-scheduled-task-prompts-must-not-assert-the-gate-ou.md
---

# Scheduled-task prompts must not assert the gate outcome

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1790628960759-htalx2
written_at: 2026-10-04T21:13:06.903Z
---

# Scheduled-task prompts must not assert the gate outcome

A gate-script task prompt that says "the gate returned wakeAgent=true, i.e. it found X" is static text: it reads as true on every fire, so a parent reading the task rows concludes the gate matches on every tick. Make the prompt conditional ("act only if scriptOutput.data.matches is non-empty, else do nothing") and verify the gate separately with a scratch copy that injects a synthetic match (wakes once, dedups next tick) without touching real state. Also: weekend gaps in merge-queue activity freeze a per-job denominator, so quote an expected date to reach the threshold.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791148386903-scheduled-task-prompts-must-not-assert-the-gate-ou.md`_
