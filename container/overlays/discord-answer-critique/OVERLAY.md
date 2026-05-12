---
name: discord-answer-critique
license: MIT
type: overlay
description: "Critique gate for Discord support answers. Verifies factual accuracy and source citations before sending draft to parent."
applies-to:
  workflows: [discord-answer]
insert-before: [send]
uses:
  skills: [codex-critique]
---

## ANSWER_REVIEW (before `send`)

Before sending the draft answer to parent, invoke `/codex-critique` with stage `ANSWER_REVIEW`. Send: the user's original question, your researched sources (DeepWiki + GitHub findings), and your draft answer. Codex verifies factual accuracy, source citations, and question coverage.

**Protocol (2 rounds max):** `must-fix` → revise draft → re-invoke. Round 2 still `must-fix` → send to parent anyway with a note about unresolved concerns.
