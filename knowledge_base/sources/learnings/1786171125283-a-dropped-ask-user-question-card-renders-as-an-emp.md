# A dropped ask_user_question card renders as an empty inbound on the parent side — read the kind column, not the text column

A session whose `ask_user_question` card is dropped by the host produces, on the *parent's* side, an inbound with an **empty body**. The parent sees "my coworker sent me an empty message." The coworker sent nothing at all. This inverts blame: the party whose question was eaten looks like the party emitting garbage.

Observed 2026-08-08 on slangpy#823. An operator told me twice that my sends were arriving empty, traced the timestamps to the right session, and offered to escalate a platform defect on my behalf. Both empty "sends" were this rendering artifact.

**The disambiguator is the `kind` column, and it is decisive:**

```
ncl sessions messages <session-id>
seq 37  out  chat-sdk  2026-08-07 15:36  [system: ask_question]   ← NOT a send_message
seq 27  out  chat      2026-08-06 22:15  [Report] slangpy#823 …   ← a real send
```

`kind=chat-sdk` + body `[system: ask_question]` is a card emission. `kind=chat` is an actual message. In the session I traced: 15 `chat-sdk` rows vs 4 real `chat` outbounds. A row's text being empty is a fact about its **rendering**; its `kind` is a fact about its **identity**. Reading text+timestamp and skipping `kind` is what produced the wrong diagnosis.

**Second signal, independently diagnostic: measure the cadence.** The card emissions were 182/182/184/183/183/181/183/183 minutes apart — ~183 min, fixed, across 9 cards. A fixed interval means a **re-arm loop on a supervisor-nudge wake**, not a human decision being awaited. Corroborating tell: that one session showed `container_status: running` while 27 siblings showed `stopped`. If you suspect a stuck session, compute the gaps — human latency is irregular, a loop is not.

**The root cause underneath, which is the expensive one:** the decision that session was gated on *had been made* the previous day and recorded in the operator's memo, but was never **delivered to the session holding the gate**. A decision recorded but not sent is indistinguishable, from the waiter's side, from a decision never made. Re-dispatch had to pin `target_session_id` — default routing would have minted a cold session with none of the context.

Practical rules:
- Diagnosing a silent/looping peer: read `kind` before concluding anything about content, and compute inter-emission gaps before concluding a human is being awaited.
- Never assume an empty inbound means the sender misbehaved. Check whether they sent at all.
- On a wake with no new work, emit one explicit line ("woke on -823, no new inbound, holding") rather than re-arming a card — an empty send is indistinguishable from a truncated one, and a re-armed card is indistinguishable from patience.
- If you hold a decision another session is blocked on, delivering it to *that session id* is part of making it.
