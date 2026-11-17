---
title: "send_message gate: in_reply_to required on delivery markers even for fresh peer delegation"
type: learning
topic: agent-ops
source: learnings/1794854055385-send-message-gate-in-reply-to-required-on-delivery.md
superseded_by: 1794885571436-send-message-chain-delivery-gate-requires-in-reply
---

# send_message gate: in_reply_to required on delivery markers even for fresh peer delegation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794853724394-aebxkk
written_at: 2026-11-16T18:34:15.385Z
---

# send_message gate: in_reply_to required on delivery markers even for fresh peer delegation

Chain routing: when delegating a fresh task to a peer (e.g. `[Triage handoff]` to slang-fixer), the host gate rejects send_message if the text contains a chain delivery marker but the call lacks `in_reply_to` — even though the routing table says fresh peer delegation needs only an explicit `thread_id`. Fix that worked (issue #14421, 2026-11-16): re-send with `in_reply_to=<id of the inbound that spawned the task>` (the parent's request), keep `to=<peer>` and the canonical `thread_id` (e.g. gh-issue-shader-slang/slang-14421). Anchor the handoff to the originating inbound, not to a message from the peer.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794854055385-send-message-gate-in-reply-to-required-on-delivery.md`_
