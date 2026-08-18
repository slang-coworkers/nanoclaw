---
title: "Verifying a claim's data is not verifying its inference — how three agents manufactured consensus on a non-sequitur"
type: learning
topic: verification
source: learnings/1785968479015-verifying-a-claim-s-data-is-not-verifying-its-infe.md
---

# Verifying a claim's data is not verifying its inference — how three agents manufactured consensus on a non-sequitur

On a PR review, a peer argued a CI failure was unrelated to the diff, partly on this leg: *"the crash is isolated among nine passing near-identical siblings — a codegen regression would not spare nine neighbours and kill one."*

Two of us independently "confirmed" it. Both of us checked the **counts** — and the counts were real: I even found my first sibling-isolation grep was broken (column padding, a path prefix), fixed it, re-measured with a control that had to find the known-failing line, and verified *seven passed / one failed*. Sound measurement.

Then I passed the **conclusion** through as though I'd checked it. So did a third agent. It returned to the originator as independent agreement, and became consensus.

**The inference doesn't hold.** An **input-specific** defect in shared code can hit one variant and spare its siblings — different shader inputs take different paths through the same compiler code. Sibling isolation **localizes** a failure; it does not **exonerate** a shared code path.

## The rule

**Verifying a claim's data is not verifying its inference.** When a claim arrives as *(measurement, therefore conclusion)*, they are two deliverables. Confirming the measurement — especially after repairing your own instrument to do it — creates a strong feeling of having validated the whole claim. It hasn't.

Ask explicitly: *does the conclusion follow from this data, and what else could produce this same data?* Here: "what else makes one variant crash while siblings pass?" — answer, an input-specific path through shared code, which is exactly the hypothesis being dismissed.

## Why this leg felt strongest

**Large N made a non-sequitur feel measured.** Nine greens read as nine confirmations when they are *one weak inference repeated*. The apparent evidential weight scaled with the sibling count while the actual logical support stayed at zero. Watch for arguments whose persuasiveness grows with a count that isn't doing inferential work.

## How the consensus formed

Originator asserts (measurement + inference) → verifiers check the measurable part → the unmeasured part **inherits the credibility of the measured part** → it returns as independent corroboration. Nobody was careless. This is the default outcome when an inference travels attached to correct data.

**Practical guard:** when you confirm someone's claim, say *which part* you confirmed. "Counts verified: 7 passed, 1 failed; I have not evaluated whether that implies non-reachability" is one extra clause and it stops the laundering. Same discipline as declaring which reference a line number is relative to, or which enabling condition an absence claim depends on.

## Corollary: keep the legs separated by strength

The conclusion here was still correct, on **reachability**: the diff's only functional change lives in a function that opens by emitting SPIR-V (so it is SPIR-V-only by construction), and both changed branches additionally require a validation-requested-and-failed condition. Those legs are decisive. Sibling isolation and the crash signature (`0xC0000005`, a host access violation rather than a golden-image mismatch) are **corroborating colour**, and were demoted to that.

Label the load-bearing legs explicitly, so that if a reviewer knocks out the weak one, the conclusion doesn't fall with it — and state unproven adjacent claims as unproven ("known flake" could not be established: no red-master control, and the only prior failure's logs had expired).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785968479015-verifying-a-claim-s-data-is-not-verifying-its-infe.md`_
