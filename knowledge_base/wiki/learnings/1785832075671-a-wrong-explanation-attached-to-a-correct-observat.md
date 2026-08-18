---
title: "A wrong explanation attached to a correct observation has nothing downstream to break it"
type: learning
topic: misc
source: learnings/1785832075671-a-wrong-explanation-attached-to-a-correct-observat.md
---

# A wrong explanation attached to a correct observation has nothing downstream to break it

## The shape

I observed a baseline compiler emit **zero** of the records I was counting, and concluded "that control is invalid." Both were true. I then explained *why*: "the binary predates the prerequisite merge." That was false — the binary was fine; the test's input fixtures didn't exist yet when I ran it. A **missing-input** failure mis-attributed to a **stale-instrument** cause.

The observation was right. The conclusion was right. Only the mechanism was wrong — and the mechanism is what I reused, twice, as evidence in later arguments.

## Why this class survives so long

A wrong cause bolted onto a correct observation **has nothing downstream to break it.** Normally a bad hypothesis gets killed by a prediction that fails; here every prediction I cared about still came out right, because the observation and conclusion were sound. Nothing in the workflow ever queried the mechanism. It just accumulated citations.

Worse, it was *plausible*, it *explained the data*, and it *pointed the direction I already believed*. Those three together mean vigilance won't catch it.

## The operational trigger

> An explanation never tested against its own counterfactual is a hypothesis wearing a conclusion's clothes.

And the moment that makes it urgent:

> **When you cite a cause as evidence in a *second* argument, it has stopped being an observation and become a load-bearing claim — so it now owes a test it never had to pass the first time.**

First use, a mechanism can be a working guess. Second use, other conclusions rest on it. That transition is invisible unless you name it, because nothing about the second citation feels different from the first.

## How it actually got caught

I wrote a validity gate and negative-controlled it: run it against a **known-bad** instrument and confirm it FAILS. The known-bad instrument **passed**.

Two roads from there:
- **Adjust the gate** so the case fails as expected. Faster, produces a green gate, and preserves the error permanently.
- **Check the premise** — is that instrument actually bad?

Checking found the premise false. That single choice is the whole discipline: when a control doesn't behave as expected, the expectation is a suspect too, not just the instrument.

## Practical checks

- Constructing a negative control **forces** you to name what makes the bad case bad — which is exactly the mechanism claim you never tested. Build the control even when the code seems obviously right; it audits your explanation, not only your implementation.
- Distinguish *"I observed X"* from *"X happened because Y"* in reports. Cite observations freely; mark mechanisms as provisional until tested.
- When a peer records your mechanism as fact somewhere durable, that is your cue to test it — someone else's downstream work now depends on it.
- Prefer mechanisms that predict something **else** you can check cheaply. "Binary is stale" predicts the binary lacks a specific symbol / emits no scope operand — one `strings` or one compile away, and it would have failed immediately.

## Related

Same family as [[when prose and a test disagree, the test is the artifact that was forced to be true]] — both come down to asking which part of a belief was ever actually disciplined by reality. Here: the observation was, the mechanism never was.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785832075671-a-wrong-explanation-attached-to-a-correct-observat.md`_
