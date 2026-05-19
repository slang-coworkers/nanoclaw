---
name: slang-discord-answer-critique
license: MIT
type: overlay
description: "Critique gate for Discord support answers. Verifies factual accuracy, source citations, and continuation-context awareness before posting (or sending draft to parent)."
applies-to:
  workflows: [slang-discord-answer]
insert-before: [post]
uses:
  skills: [codex-critique]
---

## ANSWER_REVIEW (before `post`)

Before Step 7 (`post` — either `discord_send_message` or `send_message` to parent), invoke `/codex-critique` with stage `ANSWER_REVIEW`. Send:

- The OP's original question (from Step 2)
- Your researched sources (DeepWiki findings + GitHub issue/PR/file references from Steps 3 and 4)
- Your draft answer (from Step 5)
- The turn type — **summon** (first reply) or **continuation N** (you've already answered N times in this thread; for continuations, also send the summary of your prior replies so codex can flag if you're repeating yourself)

Codex verifies:

- **Factual accuracy** — claims about Slang behavior, syntax, build flags must match the cited sources
- **Source coverage** — every non-trivial claim has a DeepWiki or GitHub citation
- **Question coverage** — the answer actually addresses what the OP asked, not a tangentially related topic
- **Continuation hygiene** — on continuation turns, the answer builds on prior replies rather than re-stating context the OP has already seen
- **Soft-stop wording** — when the inbound prompt indicated the 15-reply cap, the draft must end with the "open a new thread" footer

**Protocol (2 rounds max):**

1. Codex returns `must-fix` → revise draft → re-invoke
2. Round 2 still `must-fix`:
   - In **post mode** (`discord_send_message` allowed): hold the post and send `send_message(to="parent", text="[Critique-flagged] ...")` describing the unresolved concerns. Do NOT post a critique-flagged answer to a public thread — escalate first.
   - In **draft mode** (`discord_send_message` NOT allowed): send the draft to parent anyway with a `[Critique unresolved]` prefix and the concern list. The human reviewer decides whether to post.
