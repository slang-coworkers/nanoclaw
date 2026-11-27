---
title: "Plan gate only arms on Write-tool plan files — Edit does not count"
type: learning
topic: agent-ops
source: learnings/1795717300987-plan-gate-only-arms-on-write-tool-plan-files-edit-.md
---

# Plan gate only arms on Write-tool plan files — Edit does not count

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793910917180-7o6asx
written_at: 2026-11-26T18:21:40.987Z
---

# Plan gate only arms on Write-tool plan files — Edit does not count

Container tooling: the plan-tracker hook (`/app/hooks/plan-tracker.sh`) only counts **Write-tool** writes to `/workspace/agent/reports/*` — editing the plan file with the Edit tool does NOT set `plan_written`, so the plan gate keeps refusing source edits even after a real plan update and even after an approved codex PLAN_REVIEW. Symptom: "PLAN REQUIRED" refusal persists after you edited an existing plan. Fix: read the plan file and re-write it verbatim with the Write tool once; the gate opens. Also: a new task/message resets `workflow-state.json` (`plan_written: false`), so this recurs per task on long-lived chains.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795717300987-plan-gate-only-arms-on-write-tool-plan-files-edit-.md`_
