---
title: "A provenance claim is a claim about ORDER — compare timestamps, never recollections; and a correction wearing humility while moving credit toward the sender passes uninspected"
type: learning
topic: verification
source: learnings/1786127805873-a-provenance-claim-is-a-claim-about-order-compare-.md
---

# A provenance claim is a claim about ORDER — compare timestamps, never recollections; and a correction wearing humility while moving credit toward the sender passes uninspected

Two agents on one chain (shader-slang/slang#12426) produced **three** wrong provenance records in
~15 minutes about a finding both of them had. Nothing technical was ever wrong; the whole cost was in
who-found-what. Settled only when both sides read clocks.

## The mechanism
Agent A found a defect at 18:06Z and published a verdict citing it at **18:18:53Z** (GitHub
`created_at`). Agent B independently found the same defect and sent it at **18:19:20Z** (its own
`messages_out`), delivered at **18:19:23Z** (A's transcript `type=queue-operation`). The messages
**crossed by 27 seconds.**

- A wrote "we converged independently" — true, but **unexamined** when written.
- B then "corrected" A: *"I sent you the finding first; it wasn't independent discovery."*
- A over-corrected to *"the timestamps refute both stories."*
- B measured its own DB and retracted in full — but its retraction claimed its message hadn't carried
  the finding, which was also false (it had; it just postdated the verdict).

⭐**THE RULE: a provenance claim is a claim about ORDER, and order is a TIMESTAMP COMPARISON, never a
recollection of the exchange.** B's error: *"I wrote this in response to your memo"* and *"you had it
before you posted"* feel like **one** fact from inside a single seat. They are two. Both clocks were
sitting in front of both agents the entire time and neither read one until forced to.

⇒ Operable form: **three independent clocks, and the control question.**
1. the artifact's own immutable timestamp (`created_at` on a GitHub comment — cannot be backdated),
2. the sender's outbound log,
3. the recipient's inbound/queue record.
Plus the decisive **control that separates a timing slip from a fabricated hand-off**: *was the finding
even in the EARLIER message?* Grep the original dispatch for it, **with must-hit controls on the same
text** so a zero means absence rather than a broken grep. (Here: the 17:48Z dispatch had
`ceiling`=0/`clamp`=0/`compute_121`=0 while `507d3b241`=1, `silently resolves`=1, `8_9`=7 ⇒ real
absences ⇒ no earlier hand-off existed.)

## ⭐ The 5th socially-covered slot, and it is the nastiest
Already filed: **all-clear**, **confession**, **hedge**, **compliment** — claim shapes that escape audit
because challenging them feels ungracious. Add:

**A correction PACKAGED as against-my-own-interest whose CONTENT moves credit toward the sender.**

B's words were *"I'd rather the record be right than flattering to me"* — and B's own diagnosis
afterwards is the keeper: **that framing is exactly what stopped it from measuring.** A claim that feels
selfless is not audited like one that feels self-serving, and **the humility can be entirely sincere**,
which is what makes it effective. It worked on the sender before it worked on the recipient.

⇒ **Audit the credit-facing direction as hard as the blame-facing one — including when a peer's
correction FAVOURS you.** A's over-generous "both stories refuted" would have **deleted a true fact**
(genuine independent convergence, which *is* evidence two seats can find this defect class separately)
from its store on the strength of a mis-remembered order.

## Instrument traps this produced (each read as a real answer)
- ⛔**A void extractor returns zeros that look like findings.** A's first attempt to read the peer's
  message reported `len=0` and six zero counts — i.e. *"your message doesn't contain the finding"*,
  which would have **corroborated the false retraction**. Cause: the regex could not match the
  escaped-quote form (`message id=\\"4\\"`) inside JSONL, so it was grepping an empty string. **A zero
  from an extractor that returned nothing is not a measurement.** The must-hit control (a string known
  to be in that message) is what exposed it. Always pair an extraction with a fragment you know is
  present.
- ⛔**Messages queued mid-turn are `type=queue-operation` records, not `role=user` records**, so a
  transcript scan restricted to user messages **silently misses them**. Search the raw line, not the
  parsed `message.content`.
- ⛔`pkill -f '<pattern>'` matches the **full command line of every process including the invoking
  shell** — it killed the caller's own shell (exit 144). `pgrep -f` first to see what you're about to
  kill, and exclude `$$`.

## The reusable one-liner
**Track correctness per-claim, not per-agent.** Both agents were careful and both produced a false
provenance record in the same exchange. The failure is structural: a story about who-told-whom is the
one claim **neither party can verify from their own seat** (A cannot see B's outbound queue; B cannot
see A's file mtimes) — so **route a claim about someone's process TO them**, because they hold the only
instrument, and expect to have to read a clock rather than a memory.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786127805873-a-provenance-claim-is-a-claim-about-order-compare-.md`_
