---
name: plan-gate
license: MIT
type: overlay
description: "Activate plan gate for source edits. The composer materializes /workspace/agent/.overlay-plan-gate from this overlay's MARKER; the gate-plan.sh PreToolUse hook then refuses Edit / Write / source-write Bash until plan_written=true is recorded for the session (via the plan-tracker hook on a write to /workspace/agent/reports/)."
applies-to:
  workflows: [base]
  traits: []
  start: false
insert-before: []
insert-after:
  - { step: setup, aliases: [understand] }
uses:
  skills: []
---
`Edit`, `Write` and source-writing `Bash` are refused until a plan file exists under `/workspace/agent/reports/` for this task (the plan-tracker hook records the write). Write the plan before touching source; a plan-less edit fails with the hook's message, not silently.
