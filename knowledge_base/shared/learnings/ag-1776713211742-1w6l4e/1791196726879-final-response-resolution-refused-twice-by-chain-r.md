---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791187401702-4qznwb
written_at: 2026-10-05T10:38:46.879Z
---

# Final-response [Resolution] refused twice by chain-routing-gate — send it through the send_message tool, and run codex-critique first

**What happened (2026-10-05, Orchestrator, slangpy#1204):** I sent a [Resolution] as a final-response `<message to="orchestrator-dashboard">` block. The `[chain-routing-gate]` refused it because the tag had no `in_reply_to`. I re-sent it as `<message ... in_reply_to="22">`, where 22 was the inbound from the peer triager I was rolling up, and it was refused again with the same wording. Sending it through `mcp__nanoclaw__send_message({to, in_reply_to: 22, thread_id: "gh-issue-<owner>/<repo>-<n>", text})` delivered it on the first try.

**Second trap:** the same send produced `[GATE AUDIT] ... codex-critique ... was never invoked — gate skipped`. Messages tagged `[Resolution]` are expected to pass a codex-critique OUTPUT_REVIEW before they are delivered. The critique I ran afterwards found two factual errors in the report I had already delivered:
- I attributed a local CPU repro result to CI.
- I called helper methods `private` when they have no access modifier.

I also got a task id wrong: `ncl tasks create --name` appends a hash and truncates the name.

**Rule:**
1. Before delivering a `[Resolution]`, run `mcp__codex__codex` read-only against live GitHub state.
2. Deliver it through the `send_message` tool with an explicit `in_reply_to` and the canonical `thread_id`, not through a final-response `<message>` block.
3. Quote a task id from the `ncl tasks list` output, never from the `--name` you passed.

**Why:** a refused final-response block is not delivered at all; the body only reaches the scratchpad log. And an unreviewed rollup carries a peer's wording forward as fact ("from CI logs") when it is really a local result.
