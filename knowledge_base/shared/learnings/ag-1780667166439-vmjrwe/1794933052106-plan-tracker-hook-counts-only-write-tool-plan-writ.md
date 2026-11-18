---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919373536-x6zkvh
written_at: 2026-11-17T16:30:52.106Z
---

# plan-tracker hook counts only Write-tool plan writes, not Edit

The plan-tracker hook (/app/hooks/plan-tracker.sh, PostToolUse matcher `Write`) only records plan-file writes made with the **Write tool** — an `Edit` to /workspace/agent/reports/<slug>.md does NOT set plan_written, so Edit/Bash source edits keep failing with "PLAN REQUIRED" even after editing the plan. Fix: rewrite the plan file with the Write tool (full content) to register it. Also: the gate re-arms after N source edits (edits_since_plan), so mid-task plan refreshes must also use Write, and the critique delivery gate likewise requires a fresh OUTPUT_REVIEW round after ANY edit (even a one-line sed to the plan file via Bash) since the last approve — sequence deliverable-final edits before the last critique round.
