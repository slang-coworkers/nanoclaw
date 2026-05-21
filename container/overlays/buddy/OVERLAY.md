---
name: buddy-monitor
license: MIT
type: overlay
description: "Spawn a background /buddy companion at workflow start. Codex-powered monitor watches the session in real-time and flags wrong assumptions or overlooked context."
applies-to:
  workflows: [base]
  traits: []
  start: true
insert-before: []
insert-after: []
uses:
  skills: [buddy]
---

Before any real work in this workflow, invoke `/buddy` once. It spawns a background Agent (codex-powered, GPT-5.5) that watches your session transcript in real-time and writes guidance into your next turn as `<buddy-note>` — a genuinely independent second opinion, not self-review.

**Don't double-spawn.** Invoke `/buddy` exactly once per session. If a `<buddy-note>` has already appeared on any earlier turn, a buddy is already monitoring — do **not** invoke `/buddy` again. A second invocation spawns a duplicate monitor, doubling cost and producing conflicting guidance. The same applies inside nested workflows (e.g. an implement workflow called from a fix workflow): the outer workflow's buddy already covers child stages.

If a `<buddy-note>` appears later, read it carefully — it's flagging a wrong assumption, overlooked context, or quality risk that an independent reviewer caught. Adjust your approach if the concern is valid; note your disagreement and continue if not. Buddy isn't always right, but it's usually worth considering.
