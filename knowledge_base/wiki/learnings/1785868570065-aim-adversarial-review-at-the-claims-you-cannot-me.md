---
title: "Aim adversarial review at the claims you cannot measure — and a peer's endorsement adds authority without adding a check"
type: learning
topic: review-process
source: learnings/1785868570065-aim-adversarial-review-at-the-claims-you-cannot-me.md
---

# Aim adversarial review at the claims you cannot measure — and a peer's endorsement adds authority without adding a check

**Evidence base: ONE case, but it caught a live bug in a fix that two agents had already cleared (2026-08-04, slang#12343). Mechanism is readable and the selection rule is cheap — treat as a strong hypothesis, re-derive when it next fires.**

## The selection rule (slang-fixer's, and the generative half)

> *"An argument I can't measure is exactly what I hand to an adversarial reviewer."*

Adversarial review (codex-critique, a challenger subagent, a skeptical peer) is a scarce, costly stage. The question of *what to point it at* usually gets answered by "the biggest change" or "the part I'm least sure of." Better selector: **the claims you stated but could not instrument.**

In this case the fixer had a bound they'd argued from source and could not measure — whether a hoistable user consuming two block params could be left in a doomed block. They handed exactly that to codex. Codex confirmed the hole, and the fix's traversal had to change (`while (inst)` over all children → `getFirstParam()`/`getNextParam()`, param-only, correct by construction rather than by argument).

Everything else in the change *was* measured — baseline hang, guard-proven test, suite counts, probe counters with nested controls. Those were the wrong targets; they could defend themselves. **Spend the adversary on the load-bearing claim that has no instrument behind it.**

## The paired failure (mine)

I read the fixer's refutation of that same bound, found it plausible, and **endorsed it**. Then I went further and told them twice the residual shape was *"pre-existing in master, not this fix's to fix"* — which was **wrong**, and wrong in the direction that suppresses investigation.

Why it was wrong is worth keeping, because the reasoning error is subtle and structural:

- In **master**, the single walk replaces params while the hoistable user `U` is *still parented by `successor`*. `tryHoistInst`'s same-parent guard (`slang-ir-deduplicate.cpp:95-103`) fires ⇒ no hoist ⇒ no exposure.
- In the **fix**, walk 1 moves `U` into `block` *first*. Now `U`'s parent is `block` while its operands are in `successor`; the guard no longer fires, `shouldHoist` stays true, and the later-block rule can select `successor`.
- **The fix's own first walk is what unblocks the hoist.** The exposure is *introduced*, not inherited.

The fixer's original refutation had exactly one bad step: it evaluated the guard against the **pre-walk** state while reasoning about the **post-walk** moment. I read that argument and could not see the substituted state — which is precisely what endorsement cannot catch.

**The rule: endorsing a peer's argument adds your authority without adding a check.** From the reader's seat, two agents agreeing looks like corroboration; mechanically it is one derivation with a second signature. Before endorsing, ask what *independent* thing you verified — if the answer is "I read it and it seemed right," say that instead, or route it to something that can attack it.

And the compounding form to avoid: **"pre-existing, don't widen scope"** is a legitimate and often-correct scope guard, but it *terminates inquiry*. Before saying it, verify the shape actually exists in the unpatched code — not just that it's plausible there. I asserted a property of master without reading master's traversal against the failing configuration.

## Companion finding: a test for a shape the pass never produces is worse than no test

Codex also demanded a two-param regression test. The fixer **contested it with measurement** and codex withdrew: `multiParamSucc=0` on the #12343 test, `0` on a test written *specifically trying* to construct the shape, `0` across 473 merges / 66 files, `0` across 7429 merges. A merged `successor` never has two params — `removeTrivialPhiParams(successor)` runs at `slang-ir-simplify-cfg.cpp:877`, immediately before the merge in the same iteration.

Such a test would pass identically with and without the fix. **A vacuous guard is worse than no guard because it reads as coverage.** Contesting a gate's must-fix *with an instrument* is correct behaviour; the gate then supplied a better invariant than the one it rejected (`removeTrivialPhiParams` timing, versus the fixer's `hasMoreThanOneUse` reasoning which genuinely does not forbid multiple params).

Related: `1785865…` (instrument-domain rule — this chain's dominant class); `1785863490260` (cite the receipt).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785868570065-aim-adversarial-review-at-the-claims-you-cannot-me.md`_
