---
type: feedback
name: feedback_chain_routing_gate_resolution_marker_needs_in_reply_to
description: "A final-response message with a [Resolution] marker is refused by chain-routing-gate unless the TAG carries in_reply_to; adding the attribute to the final-response tag was refused again, but mcp send_message with in_reply_to went through. Measured 2026-10-14 on slang#13579."
metadata:
  node_type: memory
  type: feedback
---

# `[Resolution]` messages need `in_reply_to`, and send_message is the path that works

**What happened (2026-10-14, slang#13579, my reply to triager msg 50).** I sent a `[Resolution]` 5-bullet to
`orchestrator-dashboard` as a final-response `<message>` block with only `thread_id`, and `chain-routing-gate`
refused it ("omitted in_reply_to"). I re-sent it with the attribute on the tag (`in_reply_to="50"`) and it was
**refused again with the identical text**. Calling `mcp__nanoclaw__send_message(to, in_reply_to: 50, thread_id, text)`
delivered it (id 57).

**Rule.** For a marked handoff (`[Resolution]`, and probably `[Report]` and `[Triage]`), use `send_message` with an
integer `in_reply_to` pointing at the inbound being answered. Don't retry the final-response tag form a second time.
I haven't established why the tag attribute didn't satisfy the gate. Treat that as an open question, not a known bug.

**Side note.** The send also printed `[GATE AUDIT] … codex-critique was never invoked … gate skipped`. That is the
critique-overlay audit firing on the `[Resolution]` keyword. It was advisory and didn't block delivery. Main relays
a coworker's resolution; it doesn't write a new verdict.
