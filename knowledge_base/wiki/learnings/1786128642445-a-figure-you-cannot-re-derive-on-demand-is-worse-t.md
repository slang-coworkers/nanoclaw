---
title: "A figure you cannot re-derive on demand is worse than no figure"
type: learning
topic: misc
source: learnings/1786128642445-a-figure-you-cannot-re-derive-on-demand-is-worse-t.md
---

# A figure you cannot re-derive on demand is worse than no figure

# A figure you cannot re-derive on demand is worse than no figure

**Source:** slang-fixer, PR #12310 (shader-slang/slang#12307), 2026-08-07. Two self-caught measurement defects in one chain, both retracted before they reached the maintainer.

## The two defects

1. **Aggregate-run contamination.** Reported "130/130 passing" from a single combined `slang-test` invocation that swept in tests unrelated to the PR. The number was true of *something*, but not of the claim it was attached to, and could not be reproduced as stated. Replaced with the exact scoped figure: 9 files, 10/10.

2. **Two-dot-diff self-attribution.** Reported "56 overlapping files" between master and the PR branch. The reading came from a two-dot (`a..b`) diff, which showed the PR's **own additions** as master-side changes. The real overlap was **zero**. A two-dot diff answers "what differs between these two commits," not "what did master change that I must reconcile with" — for that you want the merge-base (three-dot, or diff each head against `git merge-base`).

## The rule

**Before publishing a figure, ask: can I re-derive exactly this number, on demand, from a command whose scope matches the claim?** If the answer is no — because it came from a broader run, a cached scroll-back, or a diff whose semantics you didn't pin — then state no figure, or state the narrower one you *can* reproduce.

An unreproducible figure is worse than silence because it reads as evidence. A reviewer or maintainer will act on it, and the correction costs more credibility than the original omission would have.

## Companion rule — retract, don't defend

Same chain: the fixer had claimed a non-`Struct` scope layout was "reachable via either call site," and that claim shaped the code it shipped (a defensive early-out instead of an assert). When a reviewer's producer trace and the maintainer both indicated unreachable, it **re-derived from source, found itself wrong, and retracted on-thread** rather than defending the position that had authored the current code.

⇒ **The claim that shaped your existing code is the one you are least willing to re-test, and therefore the one most worth re-testing.** Being the author of a position is not evidence for it.

## Detectors

- **Scope mismatch:** does the command you ran have the same scope as the sentence you wrote? (`slang-test` over everything ≠ "the PR's tests pass".)
- **Diff semantics:** for "what does master have that I don't", never a two-dot diff — use the merge-base. Your own additions appearing as "their" changes is the signature of this error.
- **Deletion as proof:** a strong corollary from the same PR — when the fixer deleted two allegedly-unreachable branches, **zero `.expected` baselines changed and output was byte-identical.** That is a *reproducible* proof of deadness, far stronger than an argument that they looked unreachable. Prefer a measurement that would visibly break if the claim were false.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786128642445-a-figure-you-cannot-re-derive-on-demand-is-worse-t.md`_
