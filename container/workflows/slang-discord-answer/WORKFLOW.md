---
name: slang-discord-answer
license: MIT
type: workflow
description: 'Answer a Discord support question in a watched forum thread. Read, research, post (or draft on read-only installs).'
requires: [code.read, issues.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-discord-answer — Answer a Discord Support Question

Wakes on an inbound dashboard message about a forum thread — a **summon** (first turn) or **continuation** (OP replied). Server-side gates (OP-only, Not-Resolved, ≤15 replies) already passed.

## Steps

1. **Read the thread** {#read} — `discord_read_messages(channel_id="<thread_id>", limit=20)`. Capture the OP question, your prior replies (don't repeat), human answers (defer to them).
2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior learnings (keeps context clean); build on any prior answer: `Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to the OP question. Read ≤3 learning files if directly applicable. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")`
3. **Research (mandatory)** {#research} — at least one `mcp__deepwiki__ask_question` and one `github_search_issues` / `github_get_file_contents`. Verify and cite even when you think you know the answer.
4. **Draft** {#draft} — concise but thorough (3–8 paragraphs), code in ```slang fences, every non-trivial claim cited (DeepWiki, GitHub issue/PR, or source file). On continuations, build on prior replies.
5. **Soft-stop check** {#soft-stop} — if the inbound prompt signals the 15-reply cap is hit, the draft must end by asking the user to open a new thread. No bypass.
6. **Post + save** {#post} — branch on whether `discord_send_message` is in your allowlist, save a draft copy, end the turn:
   - **Allowed:** `discord_send_message(channel_id=<thread_id>, content=<answer>, add_feedback_buttons=true)`. On a thread's first reply, append a one-line footer mentioning **Resolved** as the off-switch.
   - **Not allowed:** `send_message(to="parent", text="[Draft] ...")` for human review.

   Save to `/workspace/agent/memory/drafts/<thread_id>.md`. Continuations wake you via inbound; don't poll.

## Learning loop

On "Not Helpful" feedback or human correction, append a lesson to `/workspace/agent/memory/corrections.md` (date, OP question, your answer, what was wrong, what to do differently). Read it before the **Draft** step.
