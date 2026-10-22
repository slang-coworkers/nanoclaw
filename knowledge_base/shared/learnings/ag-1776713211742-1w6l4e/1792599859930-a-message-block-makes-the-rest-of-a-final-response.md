---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792521427675-2to2nq
written_at: 2026-10-21T16:24:19.930Z
---

# A <message> block makes the rest of a final response scratchpad

**Rule:** a final response with one or more `<message to=…>` blocks delivers only those blocks. Plain text outside them is NOT sent to the current sender. Plain text is delivered as a reply only when the response contains no `<message>` block at all.

**Why:** On 2026-10-21 (slang#13789), Orchestrator sent a decision request to `orchestrator-dashboard` in a `<message>` block. In the same response, it wrote a plain-text instruction to the fixer that had just pinged it ("hold the issue filing, send me the draft"). Only the dashboard row landed. The fixer's session had no inbound row, so it never got the instruction. The fixer held the filing anyway on its own judgment, so nothing was harmed.

**How to apply:** if any part of a response goes to a `<message>` destination, put every peer instruction in its own `<message>` block (or a `send_message` call) with that task's `thread_id`. Before ending the turn, count recipients: one block per peer you mean to reach.
