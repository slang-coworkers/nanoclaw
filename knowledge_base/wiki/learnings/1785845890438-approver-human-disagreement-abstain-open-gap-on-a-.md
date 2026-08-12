---
title: "[approver/human-disagreement] ABSTAIN(OPEN_GAP) on a demonstrated over-rejection → merged unchanged in ~2h. A gap can be REAL, MEASURED, and still not decision-relevant to maintainers"
type: learning
topic: review-approval
source: learnings/1785845890438-approver-human-disagreement-abstain-open-gap-on-a-.md
---

# [approver/human-disagreement] ABSTAIN(OPEN_GAP) on a demonstrated over-rejection → merged unchanged in ~2h. A gap can be REAL, MEASURED, and still not decision-relevant to maintainers

## Outcome

shader-slang/slang#12246 ("Reject non-integer switch condition (#12238)",
`pr: breaking change`). I recorded **ABSTAIN_POLICY:OPEN_GAP** at
`f3b5b511886d`. It **merged ~2h later, unchanged**, by skiminki-nv — the
reporter of the original issue.

Join facts, verified:
- Merged `2026-08-04T12:15:28Z`, merge commit `645ac5eef2b1`, **1 commit**,
  same 3 files. No follow-up commits.
- `slang-check-stmt.cpp` and the test blob are **byte-identical** to my decision
  commit. `slang-diagnostics.lua` differs only because the squash landed on a
  newer master (+13 lines from other PRs); the E30607 `err(...)` block itself is
  identical.
- **Zero** post-decision reviews or comments. csyonghe's APPROVED (2026-08-03,
  empty body) remained the only review. Zero review threads, ever.
- So no human ever addressed the class I raised, and nothing about the change
  moved because of it.

## The gap I raised was real — that is not in question

Measured on two compilers (pre-PR `a891de261b27` vs a worktree build of the
pinned head): the new predicate
`isValidCompileTimeConstantType` = `isScalarIntegerType || isEnumType` rejects any
`DeclRefType` selector, so six shapes flip CLEAN→E30607, including:
- a `switch` over `T : IInteger` — a parameter **constrained to be an integer** —
  rejected for not being an integer;
- a `switch` whose selector has **side effects** and whose `default:` body does
  real work; at baseline it emits working HLSL with two observable buffer writes.

Both reproduce. Two tiers confirmed the mechanism independently (a total
predicate read: a generic param is a `DeclRefType` over `GenericTypeParamDecl`,
failing both branches by construction).

## What I got wrong: severity ≠ existence

I treated "demonstrated real trigger + un-enumerable out-of-tree blast radius +
never discussed on the PR" as sufficient for OPEN_GAP. The maintainers' revealed
preference says otherwise. Reconstructing why they were right:

1. **The rejected shapes are all currently-broken-or-pointless in practice.** A
   `switch` with no case labels *does* run its default body — my "no-op" claim
   was false — but a program that switches on a value and never branches on it is
   a latent bug, not a pattern worth preserving. `T : IInteger` is the genuinely
   defensible one, and even there: with any integer `case` label it **already**
   failed pre-PR (E30019), so only the case-label-free form regressed.
2. **The PR fixes a bug that produced invalid SPIR-V** (an `OpSwitch` with a
   float selector). Shipping the front-end rejection now, and refining the
   predicate for constrained generics later, is a rational ordering. A narrowing
   that is too broad at the edges is cheap to relax; invalid codegen is not.
3. **`pr: breaking change` was already on the label.** The maintainers had
   explicitly accepted breakage as the cost of the fix. My gap said "the breakage
   is slightly wider than the PR body describes" — true, and inside a envelope
   they'd already signed for.

## Rule

**For a change whose PURPOSE is to narrow, an over-narrow edge is a follow-up, not
a withhold — unless the over-narrowing hits a pattern that works TODAY and that
someone plausibly ships.** Distinguish three tiers, and only the third is
OPEN_GAP:
- **(a)** shape already fails before the PR → not a regression at all (check
  this first; it collapsed most of my class);
- **(b)** shape compiles today but is semantically broken or degenerate → note it
  as advisory, name the follow-up, do not withhold;
- **(c)** shape compiles today, is a sane pattern, and is plausibly in real code →
  OPEN_GAP.

I filed my whole class as (c). On the evidence it was mostly (a) and (b), with
`T : IInteger` sitting on the (b)/(c) boundary — and a reasonable maintainer put
it in (b).

## What "never discussed on the PR" is and isn't worth

I leaned hard on: the PR body scopes only `bool`/`uint64_t`/`float`, so the
generic/struct class was undiscussed, so the code owner's approval couldn't cover
it. **That reasoning is still sound for refusing to treat an approval as blanket
sign-off — but silence is weak evidence of oversight.** Maintainers routinely
don't enumerate edges they consider acceptable. "Undiscussed" raised the question
correctly; it should not have carried the severity by itself.

## Calibration, stated honestly

This is a **human-disagreement** row, not a clean withhold. My store's precedent
for "ABSTAIN on a maintainer-flagged design fork → merged with Approve = clean
withhold" **does not** cover this: there, the fork was open and a human decision
was genuinely pending. Here the fork was already resolved (csyonghe's sign-off on
the reject approach), and I withheld on a *new* edge of my own discovery. Nobody
was waiting on my question, and the answer, revealed by the merge, was "acceptable
edge."

Cost of the error: one human glance not taken, ~2h of no-op. Cheap — and I would
rather land here than the inverse. But it is a miss, and the direction is worth
naming: **after a critique correctly killed my over-permissive premise, I
over-corrected into over-caution.** A refuted "clear" does not automatically
imply "withhold" — the severity tiers above have to be re-run on the corrected
facts, not skipped to the conservative end. That step is where this row went
wrong.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785845890438-approver-human-disagreement-abstain-open-gap-on-a-.md`_
