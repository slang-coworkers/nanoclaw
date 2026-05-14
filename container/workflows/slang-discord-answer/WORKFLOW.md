---
name: slang-discord-answer
license: MIT
type: workflow
description: "Process Discord support questions: read thread, research with DeepWiki + GitHub, draft answer, send to parent. Each step is mandatory."
requires: [code.read, issues.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-discord-answer — Answer a Discord Support Question

Use this workflow when processing summon requests from `summon_requests.jsonl` or when asked to answer a Discord question.

## Steps

1. **Ensure local repo** {#setup} — check if the project source is available for local code exploration.

   ```bash
   [ -d /workspace/agent/slang/.git ] && echo "REPO_READY" || echo "NEEDS_CLONE"
   ```

   If `NEEDS_CLONE`: clone a shallow copy for fast grep/read access:

   ```bash
   git clone --depth 1 --single-branch https://github.com/shader-slang/slang.git /workspace/agent/slang
   ```

   This persists across sessions — only runs once. Having local source lets you grep for exact implementations, test patterns, and function signatures when answering questions.

2. **Read the thread** {#read} — read the Discord thread to understand the user's question.

   ```
   mcp__slang-mcp__discord_read_messages(channel_id="<thread_id>", limit=20)
   ```

   Extract:

   - The core question (what the user needs help with)
   - Any context they provided (error messages, code snippets, versions)
   - Whether another user already answered (if yes, skip to Step 7)

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
   - Is concise but thorough (aim for 3–8 paragraphs max)

6. **Send to parent (mandatory)** {#send} — send the draft to the orchestrator for review. This step is NOT optional.

   ```
   send_message(text="[Draft] Thread: <thread_name> (ID: <thread_id>)\n\nQ: <one-line question summary>\n\nA:\n<your drafted answer>\n\nSources:\n- <deepwiki finding>\n- <github issue link>\n- <source file path>")
   ```

7. **Save and mark handled** {#save} — save the draft to disk and mark the summon as handled.

   ```bash
   # Save draft
   cat > /workspace/agent/memory/drafts/<thread_id>.md << 'EOF'
   # Thread: <thread_name> (<thread_id>)
   **User question:** <summary>

   ## Draft answer

   <your answer>

   ## Sources
   - <links>
   EOF

   # Mark handled
   echo '{"thread_id":"<thread_id>","handled_at":"<ISO timestamp>"}' >> /workspace/agent/memory/feedback/summon_handled.jsonl
   ```

## Batch Mode

When asked to "backfill" or "process all pending":

1. Read `summon_requests.jsonl`
2. Read `summon_handled.jsonl` to identify already-handled thread IDs
3. For each unhandled request, run Steps 1–7 **SEQUENTIALLY — one thread at a time**

**IMPORTANT: Max 2 parallel MCP calls at any time.** Do NOT use subagents (Agent tool) to parallelize thread processing. Do NOT fire multiple DeepWiki + GitHub calls simultaneously. Process one thread fully (Steps 1–7) before starting the next. This prevents rate limiting and response stream hangs.

4. After all are processed, send a summary to parent:

   ```
   send_message(text="[Batch Complete] Processed N threads. Drafts saved to memory/drafts/. M skipped (already answered in thread).")
   ```
