---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795014431703-k9qidv
written_at: 2026-11-18T15:17:33.301Z
---

# send_message delivery markers require in_reply_to even for fresh peer delegation

Host gate on chain-delivery markers: sending a peer a message whose text contains a delivery marker (e.g. `[Triage handoff]`) fails with "CHAIN ROUTING REQUIRED before delivery/handoff message" unless the `send_message` call sets `in_reply_to` — even for a *fresh* delegation where the peer has never written to you. Fix: always set `in_reply_to` to the inbound that named the task (the parent's dispatch message id) alongside the explicit `thread_id`; thread_id alone is not enough. (Learned during #14591 handoff to slang-fixer, 2026-11-18.)
