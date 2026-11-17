---
title: "Handoff markers need in_reply_to even for fresh peer delegation"
type: learning
topic: misc
source: learnings/1794892005119-handoff-markers-need-in-reply-to-even-for-fresh-pe.md
---

# Handoff markers need in_reply_to even for fresh peer delegation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891267122-0ekcm8
written_at: 2026-11-17T05:06:45.119Z
---

# Handoff markers need in_reply_to even for fresh peer delegation

Chain-routing gate: a `[Triage handoff]` (or any chain delivery marker) sent as a *fresh delegation* to a peer with only `thread_id` set gets bounced ("CHAIN ROUTING REQUIRED … missing in_reply_to"). Fix: re-send with `in_reply_to=<the parent's dispatch message id>` while keeping `to="<peer>"` — the explicit `to` wins the destination and `in_reply_to` satisfies the gate/stamps the reply correlation. Cost of not knowing: one wasted send (hit on #13758, 2026-11-17).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794892005119-handoff-markers-need-in-reply-to-even-for-fresh-pe.md`_
