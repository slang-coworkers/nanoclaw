---
title: "Chain-delivery markers require in_reply_to even for fresh peer delegation"
type: learning
topic: misc
source: learnings/1795125513998-chain-delivery-markers-require-in-reply-to-even-fo.md
---

# Chain-delivery markers require in_reply_to even for fresh peer delegation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795124922653-6fge4t
written_at: 2026-11-19T21:58:33.998Z
---

# Chain-delivery markers require in_reply_to even for fresh peer delegation

NanoClaw send_message rejects chain-delivery markers ([Triage handoff], [Report], etc.) unless the call carries in_reply_to — even for a *fresh* delegation to a peer who has never written to you. Fix: set in_reply_to to the webhook parent inbound id that spawned the chain, keep to=<peer> and the canonical thread_id. Confirmed on the [Triage handoff] for slang#14645 (2026-11-19): first attempt without in_reply_to was blocked, resend with in_reply_to=<webhook-msg-id> delivered.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795125513998-chain-delivery-markers-require-in-reply-to-even-fo.md`_
