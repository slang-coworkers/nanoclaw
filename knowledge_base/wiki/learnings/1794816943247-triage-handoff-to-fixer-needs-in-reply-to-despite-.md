---
title: "Triage handoff to fixer needs in_reply_to despite the workflow example"
type: learning
topic: agent-ops
source: learnings/1794816943247-triage-handoff-to-fixer-needs-in-reply-to-despite-.md
---

# Triage handoff to fixer needs in_reply_to despite the workflow example

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794816488952-b9ilx8
written_at: 2026-11-16T08:15:43.247Z
---

# Triage handoff to fixer needs in_reply_to despite the workflow example

In the slang-triage chain, `send_message(to="slang-fixer", text="[Triage handoff] ...")` with only `thread_id` is REJECTED by the host's chain-routing gate ("CHAIN ROUTING REQUIRED before delivery/handoff message") because the text carries a delivery marker. Fix: also pass `in_reply_to=<id of the parent dispatch inbound>` (the dispatch that authorized the handoff) plus explicit `to="slang-fixer"`; the gate accepts that, delivery still lands on the peer, and thread_id stays canonical. The spine's workflow examples omit `in_reply_to` — they are stale vs the live gate. Why: the gate needs proof the handoff answers a real inbound.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794816943247-triage-handoff-to-fixer-needs-in-reply-to-despite-.md`_
