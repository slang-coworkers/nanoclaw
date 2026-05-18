---
name: slang-discord-answer
license: MIT
type: workflow
description: "Answer a Discord support question in a watched forum thread. Triggered by an inbound dashboard message (summon button click or thread continuation reply). Read thread, research with DeepWiki + GitHub, draft answer, post to Discord (or send to parent on read-only installs)."
requires: [code.read, issues.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-discord-answer — Answer a Discord Support Question

Use this workflow when slang-discord-support is woken with an inbound dashboard message about a Discord forum thread. The inbound carries the thread ID and either:

- a **summon** (the OP clicked "Get Bot Help" — this is the first turn for the thread), or
- a **continuation** (the OP replied after you'd already answered — keep helping, subject to the 15-reply cap and Resolved gate).

Both cases are server-side filtered before you wake: only OP messages, only un-Resolved threads, only within the per-thread reply budget. By the time you're running, those gates have all passed; just do good work.

## Steps

1. **Ensure local repo** {#setup} — check if the project source is available for local code exploration.

   ```bash
   [ -d /workspace/agent/slang/.git ] && echo "REPO_READY" || echo "NEEDS_CLONE"
   ```

   If `NEEDS_CLONE`: clone a shallow copy for fast grep/read access:

   ```bash
   git clone --depth 1 --single-branch https://github.com/shader-slang/slang.git /workspace/agent/slang
   ```

   This persists across sessions — only runs once. Local source lets you grep for exact implementations, test patterns, and function signatures when answering questions.

2. **Read the thread** {#read} — read the Discord thread to understand the user's question and the conversation so far.

   ```
   mcp__slang-mcp__discord_read_messages(channel_id="<thread_id>", limit=20)
   ```

   Extract:

   - The OP's original question
   - Any context they provided (error messages, code snippets, versions)
   - Your prior replies (if continuation) — don't repeat what you already said
   - Any human helpers who already chimed in — defer to them rather than overriding
   - The most recent OP message — that's what you're responding to

   If another helper already gave a complete answer and the OP isn't asking a follow-up, end the turn quietly without posting.

3. **Research via DeepWiki (mandatory)** {#research-docs} — query DeepWiki for relevant Slang documentation. This step is NOT optional — even if you think you know the answer, verify it.

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<focused question about the user's topic>")
   ```

   Ask at least ONE question. Ask a SECOND if the first answer raises a follow-up or doesn't fully cover the user's question. Good queries:

   - "How does <feature> work in Slang?"
   - "What is the syntax for <construct>?"
   - "How do I configure <build option>?"

4. **Research via GitHub (mandatory)** {#research-code} — search for related issues, PRs, or discussions that provide additional context.

   ```
   mcp__slang-mcp__github_search_issues(query="<keywords from the question>", repo="shader-slang/slang")
   ```

   Also check source code if the question is about API/behavior:

   ```
   mcp__slang-mcp__github_get_file_contents(repo="shader-slang/slang", path="<relevant file>")
   ```

   Collect: related issue numbers, PR links, relevant source file paths.

5. **Draft the answer** {#draft} — compose a clear, helpful answer that:

   - Directly addresses the user's question
   - Includes code examples where relevant (use ```slang fences)
   - Cites sources: link to GitHub issues/PRs, reference DeepWiki findings
   - Notes any caveats or version-specific behavior
   - Is concise but thorough — Discord posts are a single message, so aim for ~3–8 paragraphs max
   - In **continuation** turns, builds on your prior reply rather than repeating context

6. **Soft-stop check** {#soft-stop} — if the inbound prompt indicates you've hit the 15-reply cap (`MAX_BOT_REPLIES_PER_THREAD`), your reply must end by asking the user to open a new thread for further questions. Example footer:

   > *I've answered this thread the maximum number of times — for any further questions, please open a new thread in #slang-support-bot and I'll be happy to help.*

   Do not try to bypass the cap. Do not post additional follow-ups after the soft-stop reply.

7. **Post or draft** {#post} — branches based on whether `discord_send_message` is in your allowlist.

   **If `discord_send_message` IS allowed** (typical prod):

   ```
   mcp__slang-mcp__discord_send_message(
     channel_id="<thread_id>",
     content="<your answer with sources cited inline>",
     add_feedback_buttons=true,
   )
   ```

   `add_feedback_buttons=true` attaches Resolved / Helpful / Not Helpful buttons. The OP can use Resolved to pause the bot in this thread. The buttons also feed into the audit log (`thread_state.jsonl`) for trends.

   On the **first** reply in a summoned thread, append a short footer mentioning the off-switch:

   > *Tip: click **Resolved** on any of my replies if this is sorted — that pauses me in this thread; click again to resume.*

   On continuation replies, omit the footer (the OP already knows).

   **If `discord_send_message` is NOT allowed** (read-only installs — dev, lego):

   ```
   send_message(to="parent", text="[Draft] Thread: <thread_name> (ID: <thread_id>)\n\nQ: <one-line question summary>\n\nA:\n<your drafted answer>\n\nSources:\n- <deepwiki finding>\n- <github issue link>\n- <source file path>")
   ```

   The human reviews and decides whether to post.

8. **Save draft locally** {#save} — keep a copy in workspace memory for replay/debugging:

   ```bash
   mkdir -p /workspace/agent/memory/drafts
   cat > /workspace/agent/memory/drafts/<thread_id>.md << 'EOF'
   # Thread: <thread_name> (<thread_id>)
   **OP question:** <summary>
   **Turn:** <summon | continuation N>

   ## Answer

   <your answer>

   ## Sources
   - <links>
   EOF
   ```

   No need to write a separate "handled" record — the audit trail lives in `thread_state.jsonl` (managed by `feedback_collector.py` and the SummonView/FeedbackView click handlers, not by you).

9. **End the turn** {#end} — once Steps 7 and 8 are done, end the turn. Do not poll for follow-ups; the next continuation reply will wake you again via the inbound message path.

## Learning from feedback

When a future turn surfaces a "Not Helpful" feedback or a human correction (either visible in the thread or relayed by your parent), append a lesson to `/workspace/agent/memory/corrections.md`:

```
## YYYY-MM-DD — Topic
**OP question:** (brief summary)
**My answer:** (what I said)
**Feedback/Correction:** (what was wrong or unhelpful)
**Lesson:** (what to do differently next time)
```

Read this file before drafting in Step 5 — it should keep you from repeating known mistakes.

## What changed (architecture notes)

If you've seen older versions of this workflow that polled `summon_requests.jsonl` or wrote `summon_handled.jsonl`: those are obsolete. Summons now arrive via dashboard inbound messages (push), not file polling. Handled state is tracked by the `feedback_collector` daemon in `thread_state.jsonl` — the agent doesn't write to it.
