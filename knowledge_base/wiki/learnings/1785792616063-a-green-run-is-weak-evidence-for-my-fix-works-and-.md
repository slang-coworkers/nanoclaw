---
title: "A green run is weak evidence for 'my fix works' and strong evidence for 'I changed nothing' — same signal, opposite weight"
type: learning
topic: verification
source: learnings/1785792616063-a-green-run-is-weak-evidence-for-my-fix-works-and-.md
---

# A green run is weak evidence for "my fix works" and strong evidence for "I changed nothing" — same signal, opposite weight

## The distinction

"All tests stay green" carries **opposite evidential weight depending on what you are claiming**:

- **Claim = "my fix works."** Green is **weak**. The test may be inert, skipped, stale-binary, or asserting an observable the bug can't move. Every failure mode in the *"present" ≠ "exercising"* family lives here.
- **Claim = "this refactor is behavior-preserving."** Green is **strong**. The assertion is behavioral *identity*, so **any** behavioral change has to break something. The suite doesn't need to target your change; it only needs to exercise the surrounding behavior, which it does by construction.

Same observation, inverted weight. Worth naming explicitly because a fleet that has been (correctly) taught to distrust green runs will over-apply that distrust to refactors, where green is close to the whole proof.

## Why it matters (slang#12281, 2026-08-03)

A maintainer asked for the plumbing around an early-out to be collapsed (−88/+55, 5 files: a virtual + default + override + shared-driver branch + two single-use predicates all folded into one local helper). The claim was **pure refactor**, so "8/8 legalization, 8/8 abort/autodiff/reflection, zero stale refs" *was* the check.

But green is only the whole check **once you have identified where the refactor could stop being behavior-preserving** and confirmed those points. Here the early-out **moved from inside the driver (after context construction) to before it**, so two things had to hold:
1. `IREmptyTypeLegalizationContext`'s body is **empty** and the base constructor only assigns fields + initializes an `IRBuilder` ⇒ **no side effect was skipped** by constructing later/never.
2. In the newly inlined if/else-if chain, an unmatched struct or array **falls through to the next global** rather than returning false early.

Both were verified. *Then* green meant something.

## How to apply

- **State your claim before reading the result.** "Fix works" → green is a smoke test, go find the assertion that fails when only your defect is reintroduced. "Nothing changed" → green is the proof, and your job is instead to enumerate the places behavior *could* have shifted.
- For a refactor, the pre-work is **not** writing new tests — it's naming the behavior-preservation risks (moved construction/initialization order, changed short-circuit or fall-through, altered lifetime, dropped side effect, sequencing across a lock) and checking each. Green then covers the rest.
- Corollary: a refactor with **no** suite coverage of the touched paths gets no benefit from green. Confirm the suites actually exercise the region before leaning on identity.
- Corollary: **the adversarial pass is not exhaustive.** On this change codex caught two stale references and the author's own follow-up sweep found a **third** codex missed. Sweep *after* review clears you, not instead of.

Related: ["present" and "passing" are not "exercising"], [Control the control], [A stale test binary can pass the very test you're validating] — this learning is the **boundary condition** on all of them.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785792616063-a-green-run-is-weak-evidence-for-my-fix-works-and-.md`_
