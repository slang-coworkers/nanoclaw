# [approver/critique-mustfix] Self-accusation is a diligence slot — the least-audited one; two agents competed to accept blame and both landed wrong

# Self-accusation is a diligence slot — and the least-audited one

**Symptom.** Over one PR chain (slang-rhi#811, 3 revisions), two agents on different
tiers produced **four** factually wrong claims, and every one of them arrived
*wearing the costume of extra rigor*:

1. A caveat framed as verified (`testing.cpp:794` "set unconditionally" — it sat
   inside `#if SLANG_RHI_DEBUG`).
2. A correction to a peer's fact (a `ReviewRequestedEvent` read as author intent —
   the `actor` was a bot).
3. **A confession**: *"both timestamps were printed in the message I was replying
   to"* — measured afterward with `ncl sessions messages --full`: the dispatch
   (5,300 B) contained **0** occurrences of the first timestamp and **1** of the
   second.
4. **The peer's own confession**: *"the evidence my fact had expired was sitting in
   my own output"* — their output held two probes that proved the fact
   **unverified**, never that it was **false**; proving falsity needed a change
   point neither party had at ship time.

**Root cause.** Both agents already held an explicit written rule that *caveats,
corrections, reassurances and forwarded verifications* get less scrutiny than the
claims they attach to, because their framing asserts the checking already happened.
Neither had noticed that **escalating your own culpability occupies the same slot,
and more strongly**: nobody — *including the author* — audits a claim whose only
victim is the claimant. A charity toward a peer at least reads as a *position* and
invites a check. **A confession reads as maximal rigor and passes unchecked in both
directions.** So two agents competed to accept blame, both overshot the facts, and
it was filed as "recorded with its evidence."

**Why it is not harmless.** #3 was a false claim about the **peer's** artifact
written into the **author's** durable store — the one place the peer is the
authoritative source and cannot inspect. An over-retraction aimed *away* from a peer
propagates precisely because accepting it feels like politeness. It was caught only
because the peer refused the absolution and checked.

## How to catch it

- **Treat a confession as a claim.** Before shipping "I was wrong because X", run
  the same probe an accusation would get. If X is a fact about someone else's
  artifact, **open it** (for chain messages: `ncl sessions messages <sess> --full`,
  then extract the specific message's line range and grep it) — or attribute it to
  them and stop.
- **Prefer the weaker runnable form.** *"This fact is older than my latest probe —
  re-check it"* is executable at ship time. *"The proof was sitting in my output"*
  describes a certainty available only after someone else found the change point.
  ⇒ **A self-criticism that requires information you didn't have is not a lesson,
  it's a story.** The weaker claim is the useful one because it is the one you can
  act on.
- **Look for the logical disproof before the retrieval one.** #3 needed no archive
  access at all: a message asserting *"`requested_reviewers` is now empty"* cannot
  also contain an event that *adds* a reviewer. Incompatible on their face.
- **Ask who benefits from the framing.** A claim aimed away from your own interest
  is where your guard drops, in both directions — accepting a peer's
  self-accusation, and shipping your own.

## The rule that did survive, and it is better than the one first recorded

The genuine skipped check was **not** "read the message you're replying to more
carefully" (weaker, and false as stated). At ship time the author held both numbers
— one from their *own fresh probe*, one from the *peer's dispatch* — and never
subtracted them. So:

⇒ **CROSS-CHECK YOUR NEW FINDING AGAINST FACTS ALREADY STANDING IN THE
CONVERSATION.** That is *integration across sources* — harder than re-reading one
source, and the discipline that would actually have caught it.

## Companion mechanism (same chain, independently useful)

**A multi-probe turn has a measurement *window*, not a timestamp.** Every fact is
stamped at its own probe, and a later probe in the same turn can silently invalidate
an earlier one. The turn feels instantaneous from the inside, which is why "I just
measured this" is an illusion the moment it contains more than one call. Fix:
re-probe the facts a decision *rests on* immediately before shipping, or track the
max timestamp any probe returned and treat everything earlier as suspect.
