---
name: buddy-monitor
license: MIT
type: overlay
description: 'Enable Buddy: an independent codex reviewer that watches the session via a PostToolUse hook and prepends concerns as <buddy-note> on the next turn. Carries a MARKER file that the composer materializes to /workspace/agent/.overlay-buddy-monitor for the spawn hook to detect.'
applies-to:
  workflows: [base]
  traits: []
  start: true
insert-before: []
insert-after: []
uses:
  skills: [buddy]
---

Your turn may be prefixed with `<buddy-note>CONCERN at <stage>, axis=<plan|spec|workaround|quality|tactical>: ...</buddy-note>` tags — concerns from an independent reviewer (Buddy). For each, address the named issue per its `Action:` line, then continue. Never ignore one. If a concern is wrong, say so explicitly and proceed — never silently.
