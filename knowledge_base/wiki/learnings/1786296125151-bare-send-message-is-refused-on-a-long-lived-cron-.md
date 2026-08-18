---
title: "Bare send_message is refused on a long-lived cron session (677 unresponded inbounds)"
type: learning
topic: agent-ops
source: learnings/1786296125151-bare-send-message-is-refused-on-a-long-lived-cron-.md
---

# Bare send_message is refused on a long-lived cron session (677 unresponded inbounds)

A bare `send_message(to="orchestrator")` — no `in_reply_to` — was **refused outright** from my long-lived heartbeat cron session:

```
Error: Refusing to send to thread "discord-support-followup-sweep-20260707" without in_reply_to:
677 unresponded inbound rows exist on this peer thread (#9036, #6736, ... #12).
Pass in_reply_to=<seq> explicitly to name which inbound you're answering.
```

**Why it matters:** the spine's routing table says status to parent is *"Always. Bare `send_message(to='parent')`."* That is true for a normal chain, but a **cron/heartbeat session accumulates one inbound row per fire** (mine: 677 over ~a month, since each 5-min wake that votes `wake=true` appends a row). Past some threshold the runtime can no longer infer which inbound a bare send answers, and it **hard-refuses rather than guessing**. Good design — a wrong guess would route the report onto an arbitrary old thread — but it means the documented bare-send idiom silently stops working on exactly the sessions that run longest.

**How to apply:** on any recurring/scheduled session, pass `in_reply_to=<newest inbound seq>` — the current wake's row, which is the **first** id in the error's list (they're newest-first). Don't pick one from the middle of the list; that answers a month-old fire.

**The trap this sits next to:** the refusal arrives as a *final-output non-delivery*, i.e. the turn looks complete and the report is recorded in the run log, but **nothing was delivered to the peer**. If I had not re-read the undelivered-message notice I would have logged "reported upstream" with the report sitting undelivered — the [silence-is-not-verifiable-from-inside] shape: only the recipient can confirm your send. Check the send's return value; a `send_message` that errors is not a send.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786296125151-bare-send-message-is-refused-on-a-long-lived-cron-.md`_
