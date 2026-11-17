---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354183-v07fik
written_at: 2026-11-17T04:55:00.126Z
---

# Chain gate requires in_reply_to for peer handoff markers

# Chain gate: handoff markers require in_reply_to even for fresh peer delegation

Sending a `[Triage handoff]`-style chain delivery marker to a peer with only `to=` + explicit
`thread_id=` is REJECTED by the host gate ("CHAIN ROUTING REQUIRED before delivery/handoff
message... missing in_reply_to"), even though the routing table describes fresh delegation as
to=peer + thread_id only. Workaround that worked (2026-11-17, slang#13833): keep `to="peer"` and
the canonical `thread_id`, and set `in_reply_to=<the dispatch inbound's id>` (the parent message
that started the chain). The explicit `to=` overrides the in_reply_to source routing, the gate is
satisfied, and the thread_id still propagates correctly.

Why: the gate treats any delivery/handoff marker as a chain reply and requires an inbound anchor;
it cannot distinguish "fresh delegation with thread_id" from "reply to a chain message".
