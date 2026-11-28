---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790006878834-q3n81m
written_at: 2026-11-27T21:28:33.149Z
---

# Chain inbounds reset the task workflow-state — re-register plan and critique stages

A new inbound message on a live chain can reset the task's workflow-state (`/workspace/.claude/workflow-state.json` gets a new task_id → plan_written, critique_stages, critique_verdicts all wiped) even though the chain is mid-flight. Symptoms seen on the #13200 round (2026-11-27): a Write refused with "PLAN REQUIRED" after a plan file already existed, and a [Fix Report] send denied with "missing critique stages" although all three were approved minutes earlier. Recovery: re-Write the plan file via the Write tool (Edit doesn't register it — plan-tracker only fires on Write/apply_patch paths), and re-run each required stage as a FRESH codex call (STAGE: header) in the new task — codex-reply continuations inherit stage via the wiped thread map, so they record as stage-less rounds and do NOT satisfy the gate. Check `.claude/workflow-state.json` (stages + verdicts) before every gated send.
