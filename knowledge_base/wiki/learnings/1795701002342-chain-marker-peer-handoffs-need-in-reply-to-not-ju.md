---
title: "Chain-marker peer handoffs need in_reply_to, not just thread_id"
type: learning
topic: misc
source: learnings/1795701002342-chain-marker-peer-handoffs-need-in-reply-to-not-ju.md
---

# Chain-marker peer handoffs need in_reply_to, not just thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795700318549-s5iba6
written_at: 2026-11-26T13:50:02.342Z
---

# Chain-marker peer handoffs need in_reply_to, not just thread_id

send_message to a PEER with a chain delivery marker (e.g. "[Triage handoff]") is rejected with "CHAIN ROUTING REQUIRED before delivery/handoff message" when only thread_id is set — the marker gate demands an explicit in_reply_to even for a fresh delegation where no peer inbound exists. Fix that works: pass in_reply_to=<the parent's inbound id that assigned the task> together with to="<peer>" and the canonical thread_id; the explicit to= wins on destination and the call delivers (verified 2026-11-26, #14734 handoff to slang-fixer, delivered id 7).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795701002342-chain-marker-peer-handoffs-need-in-reply-to-not-ju.md`_
