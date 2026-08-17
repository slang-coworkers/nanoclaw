---
title: "A hold waiting on a named person carries an unstated liveness premise"
type: learning
topic: misc
source: learnings/1785955455527-a-hold-waiting-on-a-named-person-carries-an-unstat.md
---

# A hold waiting on a named person carries an unstated liveness premise

# "RESUME = <person> answers" has an invisible expiry

**Incident (slangpy#823, parked 2026-08-04, voided 2026-08-05).**

I triaged an issue to `needs-maintainer-input` and parked the chain with the resume trigger
*"assignee `mkeshavaNV` picks option A/B/C."* That was the correct disposition — the decision was a
genuine product-scope call, not ours to make. The hold was well-formed and I re-probed it.

A day later a different member commented: *"Mukund won't be returning to this work for a while.
Please scrub this issue and assess whether it is still relevant, needs reassignment, or should be
closed."*

**The gate wasn't slow. It was void — and had been for an unknown period.**

## Why no amount of re-probing would have caught it

Every probe I ran tested whether the gate had **moved**: is there a new comment? did the PR change
state? All correctly returned "no change." None of them could test whether the gate **could still
move**. The artifact was actively misleading in a way that isn't anyone's fault:

- `assignees` still read `mkeshavaNV` — assignment does not expire when a person does
- the issue looked byte-identical whether he was deciding tomorrow or never
- the last human nudge (another member asking him to verify) made the gate look *live*, because
  someone had recently cared about it

> **An abandoned gate and a slow gate render identically.** Same family as the inert guard: the
> state that cannot say "I will never resolve" looks exactly like the state that hasn't resolved
> yet.

## The rule

> **"RESUME = \<person\> answers" carries an unstated premise: that the person is still available
> to answer.** Nothing in the tracker will ever falsify it. Prefer a trigger with a second,
> person-independent disjunct ("or PR #N leaves conflicted", "or 30 days elapse"), so the chain has
> a path forward that doesn't route through one human's calendar.

Staleness signals that *are* on the artifact and worth reading as soft evidence: a milestone two
quarters in the past, a self-assigned "I'll verify and close" with no reply for months, a linked PR
untouched for weeks. Individually weak — collectively they say the gate may not be live.

## The second trap, on the way out

When the departing person's stated position was one of the options ("I think this is won't-fix"),
that opinion **survives as a data point; their authority to decide does not.** Don't execute their
preference as though it were a decision, and don't discard it either — hand it to the new owner
labelled as what it is.

Also: when proposing a reassignment, recent activity on the artifact is evidence of activity **on
that date**, not of current availability. Proposing a name is fine; asserting someone is available
repeats the exact error the incoming message just corrected about someone else.

## Related

- A guard can be inert and still read as passing.
- A substantive human comment re-opens a closed or holding chain — your prior "holding" note is a
  past position, not a reply.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785955455527-a-hold-waiting-on-a-named-person-carries-an-unstat.md`_
