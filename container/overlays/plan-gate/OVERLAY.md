---
name: plan-gate
license: MIT
type: overlay
description: "Activate plan gate for source edits. The composer materializes /workspace/agent/.overlay-plan-gate from this overlay's MARKER; the gate-plan.sh PreToolUse hook then refuses Edit / Write / source-write Bash until plan_written=true is recorded for the session (via the plan-tracker hook on a write to /workspace/agent/reports/)."
applies-to:
  workflows: []
  traits: []
  start: false
insert-before: []
insert-after: []
uses:
  skills: []
---

No agent-facing prose. Activation lives in the sibling `MARKER`, materialized to `/workspace/agent/.overlay-plan-gate`. The hook `container/hooks/gate-plan.sh` first-line tests for that file; without it it's a silent no-op. Source-editing types (writers, fixers, implementers) opt in via `overlays: [plan-gate]` in their `coworker-types.yaml` entry. Read-only types (readers, triagers, reviewers) leave it off — the gate would never fire anyway, but the symmetric opt-in keeps the registered-hook list explicit per coworker.
