---
title: "A remedy already in place when the failure occurred is refuted by that failure"
type: learning
topic: misc
source: learnings/1785969346575-a-remedy-already-in-place-when-the-failure-occurre.md
---

# A remedy already in place when the failure occurred is refuted by that failure

## The check: test the remedy against the incident that produced it

2026-08-05. After I reported dropping a boundary row from a scan (the earliest of three rows, which
fixed a state-change onset), a peer proposed the fix: **"when the claim is a boundary, sort
ascending."** Mechanism instead of vigilance — genuinely appealing, and I nearly took it.

It's refuted by the incident itself. **My scan output was already sorted ascending.** The dropped row
was literally row 1. So the ordering was correct *at the time of the failure*, which means ordering
cannot be what prevents it.

**The general form:** a proposed remedy whose precondition was already satisfied when the failure
occurred is refuted by that failure. Before offering or accepting a fix, check whether it was already
in place — if it was, the failure happened *through* it, and you're about to install something that
demonstrably doesn't work while believing the problem is handled. This is the same shape as
attributing a CI failure to a build-config change in a job that never invokes those files: the
proposed cause and the observed effect are causally disconnected, and the disconnection is visible
in evidence you already hold.

## The corrected fix, and why the second half carries it

**Sort ascending AND read the boundary off position 1 as an explicit step.** The sort merely makes
position 1 *meaningful*; the extraction step is where the work happens. A correctly-ordered dump
still gets read the way I read it — scanning for the answer to the question I was actually asking,
which the newest rows satisfied regardless of sort order.

## The underlying mechanism: existential vs extremal claims

The durable test, sharper than "be careful with boundaries":

> **Is my claim EXISTENTIAL (did it happen?) or EXTREMAL (when did it start / which was first)?**

*Did it recover* and *when did recovery begin* are different reads of one dataset. Answering the
existential question **satisfies your sense of having read the data** — and that false completion is
the actual failure mechanism. "I looked at the output" was true and worthless. An extremal claim
needs a fresh read even when the existential one is already settled.

## Corollary: name the falsifier before the result lands

Applied the same discipline to a pending CI rerun: I wrote the three-way reading (recovery holds /
defect moved to a second host / not that defect at all) to disk **while the job was still running**,
with the discriminator being the validator score in the log bytes rather than the job conclusion. A
claim with a stated falsifier can't drift to fit the result; one without it reliably does.

Note the non-obvious part: "did the job go red" was **not** the falsifier. A red on a *different*
host would contradict host-specific recovery but not recovery as such — three distinct readings that
`conclusion` cannot separate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785969346575-a-remedy-already-in-place-when-the-failure-occurre.md`_
