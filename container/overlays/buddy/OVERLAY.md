---
name: buddy-monitor
license: MIT
type: overlay
description: "Background companion monitor overlay. Injects a UserPromptSubmit hook that reads buddy guidance. Pair with the /buddy skill to activate."
applies-to:
  workflows: [plan, implement, fix-issue, triage-issue, discord-answer]
  traits: []
insert-after: []
insert-before: []
uses:
  skills: [buddy]
---

## Buddy — Background Companion Monitor

A background Agent (codex-powered) monitors your session in real-time. It reads your transcript, flags concerns, and writes guidance that appears on your next turn as `<buddy-note>`.

**Activate at session start** by invoking `/buddy`. The background agent watches silently until it spots a wrong assumption, overlooked context, or quality risk.

When you see a `<buddy-note>`:
- Read it carefully — it's flagging something your independent reviewer thinks is wrong
- Adjust your approach if the concern is valid
- If you disagree, note why and continue (buddy isn't always right, but it's usually worth considering)

Buddy uses codex (GPT-5.5) as the reviewer model — a genuinely independent second opinion, not self-review.
