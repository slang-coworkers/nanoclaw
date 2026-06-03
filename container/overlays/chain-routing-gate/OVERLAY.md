---
name: chain-routing-gate
type: overlay
description: "Activate deterministic chain handoff routing enforcement. The composer materializes /workspace/agent/.overlay-chain-routing-gate from this overlay's MARKER; the text-output dispatcher and the gate-chain-routing.sh PreToolUse hook refuse delivery/handoff messages (marked [Fix Report]/[Resolution]/[Triage Resolution]/[Review Verdict]/[handoff]) unless they carry in_reply_to (thread_id is optional — the runtime derives it). A 3-denial soft-cap prevents thrash."
version: 1.0.0
applies-to:
  start: false
  workflows: []
uses:
  skills: []
---
No agent-facing prose. Activation lives in the sibling `MARKER`, materialized to `/workspace/agent/.overlay-chain-routing-gate`. The in-process dispatcher gate first-line tests for that file; without it it's a silent no-op.
