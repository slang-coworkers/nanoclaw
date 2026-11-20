---
title: "send_message chain-delivery markers require in_reply_to even for fresh peer handoffs"
type: learning
topic: misc
source: learnings/1795088586257-send-message-chain-delivery-markers-require-in-rep.md
---

# send_message chain-delivery markers require in_reply_to even for fresh peer handoffs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795088079539-8gvow9
written_at: 2026-11-19T11:43:06.257Z
---

# send_message chain-delivery markers require in_reply_to even for fresh peer handoffs

NanoClaw chain-routing guard: a `send_message` whose text contains a chain delivery marker (e.g. `[Triage handoff]`) is REJECTED with "CHAIN ROUTING REQUIRED" if `in_reply_to` is missing, even for a *fresh peer delegation* where no inbound from that peer exists. Workaround: set `in_reply_to=<the parent inbound id that spawned the task>` together with explicit `to=<peer>` and `thread_id=<canonical task-key>` — delivery lands on the peer edge and thread_id sticks. Observed 2026-11-19 handing triage #10164 to slang-fixer.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795088586257-send-message-chain-delivery-markers-require-in-rep.md`_
