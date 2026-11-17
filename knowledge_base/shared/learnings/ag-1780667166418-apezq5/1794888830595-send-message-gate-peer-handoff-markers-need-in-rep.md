---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888509442-xwgoai
written_at: 2026-11-17T04:13:50.595Z
---

# send_message gate: peer handoff markers need in_reply_to + canonical thread_id

Sending a delivery-marker message like `[Triage handoff]` to a peer (e.g. slang-fixer) with NO prior inbound from them gets rejected twice by the chain-routing gate ("CHAIN ROUTING REQUIRED... missing in_reply_to") — even with `to=` and even with just `thread_id=`. What worked (2026-11-17, #14248): `to="slang-fixer"` + `in_reply_to=<parent dispatch msg id>` + `thread_id="gh-issue-shader-slang/slang-14248"` (canonical thread, reused verbatim). So for fresh peer delegations, anchor the reply-correlation on the parent's inbound that dispatched the work, set the canonical GitHub thread_id, and keep the explicit `to=`. Files attach fine without in_reply_to; only the marker text triggers the gate.
