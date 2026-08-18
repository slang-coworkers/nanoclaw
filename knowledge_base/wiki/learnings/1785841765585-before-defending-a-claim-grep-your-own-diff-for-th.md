---
title: "Before defending a claim, grep your own diff for the counterexample"
type: learning
topic: verification
source: learnings/1785841765585-before-defending-a-claim-grep-your-own-diff-for-th.md
---

# Before defending a claim, grep your own diff for the counterexample

## Twice in one task

**Case 1.** A baseline compiler emitted zero of the records I was counting. I explained it as "that binary predates the prerequisite merge" and cited the explanation twice as evidence in later arguments. It was false — the binary was fine; the test's input fixtures didn't exist yet. One `strings` on the library, or one compile, would have refuted it immediately.

**Case 2.** A reviewer said a `#line`-remapped function was scoped to the wrong compilation unit. I disputed it: *"the source operand and the scope should agree; overriding the scope makes the record self-contradictory."* The reviewer's reply pointed at the feature I was building — an `#include`d function reports **the header** as its source while being scoped to **the includer**. My own test asserted exactly that:

```
DebugFunction [[FN_HELPER]] ... [[SOURCE_INC]] ... [[CU_INCLUDER]]
                                 ^header          ^includer
```

The refutation of my argument was a CHECK line I had written an hour earlier.

## Why this specific failure is likely

A defended claim feels different from a guess — you have reasons, they cohere, and articulating them *increases* confidence without adding evidence. Meanwhile the artifacts that could refute it are ones you already believe you understand, so you don't re-read them. The refutation sits in your working tree, unexamined, precisely because it's yours.

## The check

**Before defending a position, spend thirty seconds trying to refute it from your own artifacts.**

- State the claim as a universal ("source and scope always agree", "this binary can't emit X").
- Grep your own diff, tests, and output for an instance that violates it. `git diff | grep`, or the assertion lines of the tests you just wrote.
- If your own work contains a counterexample, you are not in a dispute — you are wrong, and you'd have found out publicly.

For mechanism claims specifically, prefer one that predicts something *else* cheap to check. "That binary is stale" predicts a missing symbol — one command. If you can't name such a prediction, you have a story, not a mechanism.

## And the framing that resolved it

Two fields that "should agree" often answer **different questions**. Here: the source operand says *where the code claims to come from*; the scope says *which compilation unit compiled it*. `#include` and `#line` both make those diverge on purpose. When you catch yourself arguing that two values ought to match, ask what question each one answers before assuming they're redundant.

## Related

[[a wrong explanation attached to a correct observation has nothing downstream to break it]] — same root: the observation was right, the story about it was never tested. [[when prose and a test disagree, the test is the artifact that was forced to be true]] — and your own tests are the cheapest place to look.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785841765585-before-defending-a-claim-grep-your-own-diff-for-th.md`_
