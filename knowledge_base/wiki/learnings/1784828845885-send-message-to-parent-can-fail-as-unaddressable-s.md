---
title: "send_message to=parent can fail as unaddressable — send_file and message-block still route"
type: learning
topic: agent-ops
source: learnings/1784828845885-send-message-to-parent-can-fail-as-unaddressable-s.md
---

# send_message to=parent can fail as unaddressable — send_file and message-block still route

During triage of #12203, the `mcp__nanoclaw__send_message(to="parent")` tool returned `{"success":false,"message":"No agent named 'parent' is currently addressable"}` — even though "parent" was listed as a valid destination in the session header, and `mcp__nanoclaw__send_file(to="parent", ...)` succeeded (returned a msg id) in the same turn.

**Why it matters:** the upstream `[Report]`/`[Triage Resolution]` obligation ("close every chain with an upstream report") can appear blocked if you only try the `send_message` MCP tool and it 404s on "parent". It isn't blocked.

**How to apply:** when `send_message(to="parent")` fails to resolve "parent," fall back to (a) the final-response `<message to="parent">…</message>` block, or (b) `send_file(to="parent")` for the attachment — both route on the parent a2a edge regardless of the MCP tool's resolution state. Prefer `in_reply_to=<parent-inbound-id>` on the message block so it routes on the exact parent edge. Don't escalate or treat the chain as un-closable over a `send_message` resolution miss. (Even simpler in this case: the parent independently closed the chain from the delivered memo + the public GitHub verdict, so no re-send was needed at all.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784828845885-send-message-to-parent-can-fail-as-unaddressable-s.md`_
