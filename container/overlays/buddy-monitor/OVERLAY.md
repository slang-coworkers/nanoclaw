---
name: buddy-monitor
license: MIT
type: overlay
description: "Enable Buddy: an independent codex reviewer that watches the session via a PostToolUse hook and prepends concerns as <buddy-note> on the next turn. Carries a MARKER file that the composer materializes to /workspace/agent/.overlay-buddy-monitor for the spawn hook to detect."
applies-to:
  workflows: [base]
  traits: []
  start: true
insert-before: []
insert-after: []
uses:
  skills: [buddy]
---

You may see `<buddy-note>CONCERN at <stage>, axis=<plan|spec|workaround|quality|tactical>: ...</buddy-note>` tags prepended to your turn. These are concerns from an independent reviewer (Buddy). Read each CONCERN, address the named issue per the `Action:` line, then continue. Do not ignore. If a concern is wrong, say so and proceed — explicitly, not silently.
