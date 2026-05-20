---
name: slang-discord-answer
license: MIT
type: workflow
description: "Answer a Discord support question in a watched forum thread. Triggered by an inbound dashboard message (summon or continuation). Read, research, post (or draft on read-only installs)."
requires: [code.read, issues.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-discord-answer — Answer a Discord Support Question

Run this when slang-discord-support is woken with an inbound dashboard message about a forum thread. The inbound is either a **summon** (first turn) or a **continuation** (OP replied after you'd answered). Server-side gates (OP-only, Not-Resolved, ≤15 replies) have already passed by the time you wake.

## Steps

1. **Read the thread** {#read} — `discord_read_messages(channel_id="<thread_id>", limit=20)`. Capture the OP's question, your prior replies (if continuation — don't repeat yourself), and any humans who already answered (defer to them).

2. **Recall** {#recall} — Before researching, spawn an `Agent` subagent to scan prior shared learnings for hits on this question or similar Discord answers. Keeps your context clean.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to the OP question (extract topic from Step 1). Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

   If a prior answer exists, build on it rather than re-deriving from scratch.

3. **Research (mandatory)** {#research} — at least one `mcp__deepwiki__ask_question` and one `github_search_issues` / `github_get_file_contents`. Even when you think you know the answer, verify and collect citations.

4. **Draft** {#draft} — concise but thorough (3–8 paragraphs), with code in ```slang fences, every non-trivial claim cited (DeepWiki link, GitHub issue/PR, or source file). On continuations, build on prior replies; don't re-state context the OP has already seen.

5. **Soft-stop check** {#soft-stop} — if the inbound prompt indicates the 15-reply cap is hit, the draft must end by asking the user to open a new thread. No bypass.

6. **Post + save** {#post} — branches on whether `discord_send_message` is in your allowlist, then save a draft copy locally and end the turn:

   - **Allowed:** `discord_send_message(channel_id=<thread_id>, content=<answer>, add_feedback_buttons=true)`. On the first reply in a thread, append a one-line footer mentioning **Resolved** as the off-switch.
   - **Not allowed:** `send_message(to="parent", text="[Draft] ...")` for human review.

   Save the answer to `/workspace/agent/memory/drafts/<thread_id>.md` for future reference. Continuation replies wake you again via inbound; don't poll.

## Learning loop

When a "Not Helpful" feedback or human correction surfaces in a future turn, append a short lesson to `/workspace/agent/memory/corrections.md` (date, OP question, your answer, what was wrong, what to do differently). Read this file before drafting in Step 3 to avoid repeating mistakes.

## Architecture note

If you've seen older versions polling `summon_requests.jsonl` or writing `summon_handled.jsonl`: those are obsolete. Summons arrive via dashboard inbound (push). Handled state is `feedback_collector`'s responsibility (`thread_state.jsonl`), not yours.
