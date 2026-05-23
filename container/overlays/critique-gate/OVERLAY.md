---
name: critique-gate
license: MIT
type: overlay
description: "Activate critique gate for delivery markers. The composer materializes /workspace/agent/.overlay-critique-gate from this overlay's MARKER; the gate-critique-on-deliver.sh PreToolUse hook then refuses [Fix Report] / [Resolution] / [Triage Resolution] / [Review Verdict] / [handoff] send_message and `gh pr create` until /codex-critique has run for the session."
applies-to:
  workflows: []
  traits: []
  start: false
insert-before: []
insert-after: []
uses:
  skills: [codex-critique]
---

This overlay carries no agent-facing prose. Activation lives in the sibling `MARKER` file (per delta v3 Change 4) which the composer materializes to `/workspace/agent/.overlay-critique-gate`. The hook `container/hooks/gate-critique-on-deliver.sh` first-line tests for that file; without it the hook is a silent no-op. The agent learns about `/codex-critique` via the `codex-critique` skill — there is nothing to splice into the spine here.
