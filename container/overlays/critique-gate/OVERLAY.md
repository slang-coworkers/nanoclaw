---
name: critique-gate
license: MIT
type: overlay
description: "Activate critique gate for delivery markers. The composer materializes /workspace/agent/.overlay-critique-gate from this overlay's MARKER; the gate-critique-on-deliver.sh PreToolUse hook then refuses [Fix Report] / [Resolution] / [Triage Resolution] / [Review Verdict] / [handoff] send_message and `gh pr create` until /codex-critique has run for the session."
applies-to:
  workflows: [base]
  traits: []
  start: false
insert-before:
  - { step: draft-pr, aliases: [ship] }
  - { step: report, aliases: [forward-up, deliver, handoff] }
  - { step: forward, aliases: [] }
insert-after: []
uses:
  skills: [codex-critique]
---
Before `gh pr create`, `[Fix Report]`, `[Fix Review Request]`, `[Review Verdict]`, `[Triage handoff]` or `[Triage Resolution]`: `/codex-critique` must have recorded every stage listed in `/workspace/agent/.critique-required-stages` for this session with verdict `approve`. The deliver hook (`gate-critique-on-deliver.sh`) refuses the message or the PR otherwise and names the missing stage, so run the stage's critique as part of this step, not after the refusal.
