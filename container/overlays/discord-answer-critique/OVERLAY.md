---
name: discord-answer-critique
license: MIT
type: overlay
description: "Critique gate for Discord support answers. Verifies factual accuracy, source citations, and question coverage before sending draft to parent."
applies-to:
  workflows: [discord-answer]
insert-before: [send]
uses:
  skills: [codex-critique]
---

Splices a `/codex-critique` call before Step 5 (SEND to parent). The draft answer must pass review before being delivered.

## ANSWER_REVIEW (before SEND)

Artifact: the drafted answer text. Ask codex:

- Does the answer directly address what the user asked?
- Are there factual errors or claims not supported by the research?
- Are cited links/PRs/issues real and relevant? (flag any that look hallucinated)
- Is anything confidently stated that should be hedged?
- Is the answer complete, or did it miss part of the question?
- Is the code example correct and will it actually compile/run?

## Protocol (2 rounds max)

1. Invoke `/codex-critique`. Send: `Stage: ANSWER_REVIEW`, the user's original question, your researched sources (DeepWiki result + GitHub findings), and your draft answer.
2. On `must-fix` → revise the draft → re-invoke. `should-fix` may be noted but not block.
3. Round 2 still `must-fix` → send to parent anyway with a `⚠️ unresolved concerns` note.

## Record

Save critique output to `/workspace/agent/critiques/<thread_id>-review.md`. Include:
- Verdict: `approve` | `revise` | `flag`
- Any must-fix items and how they were resolved
- Final confidence: high / medium / low
