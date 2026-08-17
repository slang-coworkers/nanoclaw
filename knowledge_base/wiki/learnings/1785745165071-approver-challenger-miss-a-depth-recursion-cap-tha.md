---
title: "[approver/challenger-miss] A depth/recursion cap that returns the PERMISSIVE value fails OPEN into the very bug the PR fixes — and E39997 is NOT a universal front-end gate"
type: learning
topic: review-approval
source: learnings/1785745165071-approver-challenger-miss-a-depth-recursion-cap-tha.md
---

# [approver/challenger-miss] A depth/recursion cap that returns the PERMISSIVE value fails OPEN into the very bug the PR fixes — and E39997 is NOT a universal front-end gate

## Symptom

On shader-slang/slang#11118 (mark `Atomic<T>` `[__NonCopyableType]`, add transitive
`typeContainsNonCopyableImpl`, promote `BorrowInOut → Ref`), the production bot
flagged: "depth cap returns permissive `false`, silently re-introducing the
invalid-SPIR-V bug for pathologically deep nesting."

I **cleared it as pure future-proofing** on the theory that the front end already
rejects anything that deep. An independent critique proved that wrong, and the
gap became the *principal* ground for ABSTAIN.

## Root cause of the miss

I over-generalized a prior learning
(`1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f`) which
correctly says: don't add a recursion guard when an earlier fatal diagnostic
already rejects the input (there, `struct S { S next; }` fatals at **E39997**,
`kMaxTypeNestingDepth=128`, `slang-check.h:21`; cyclic inheritance at **E39999**).

I treated "E39997 exists" as "the front end universally rejects >128 nesting
before IR lowering." **It does not.** At the pinned head, E39997 is raised by
*specific walkers* that each carry their own `recursionDepth` counter:
- `slang-check-shader.cpp:604` — entry-point specialization-param walk
- `slang-check-shader.cpp:1307`, `:1509`, `:1645` — varying/entry-point validation
- `slang-type-layout.cpp:5320`, `slang-check-expr.cpp:2020`, `:2725`,
  `slang-check-decl.cpp:3173` — other independent walkers

There is no single gate every declaration must pass. E39999 covers inheritance
*cycles* only — not a deeply-nested **acyclic** generic struct, which is a
perfectly valid program.

So a valid >128-deep nesting containing an `Atomic<T>` reaches
`typeContainsNonCopyableImpl`, hits `if (depth >= kMaxTypeNestingDepth) return
false`, is reported "copyable", skips the `BorrowInOut → Ref` promotion, and
silently emits the copy-in/copy-out the PR exists to remove.

The audit found a **second** defect on the same lines: the comment asserts the cap
only guards "malformed programs" and that "valid programs have finite-depth struct
layouts, so this limit is only a safety guard" — materially misleading, since
finite and valid does not imply shallower than a fixed 128.

## How to catch it

When a diff adds a **bounded** recursive predicate, ask two questions in order:

1. **Which direction does the fallthrough fail?** Write out what the cap's return
   value *means* to every caller. If the permissive/default value routes to the
   pre-fix behavior, the guard reintroduces the bug at the boundary instead of
   erroring. For a predicate gating a correctness transform, the conservative
   return is the one that *keeps* the transform (`return true` here), or a
   diagnostic — never the one that silently opts out.
2. **Is the "already rejected upstream" claim a UNIVERSAL gate or a per-walker
   counter?** Don't accept "diagnostic E-NNNNN exists" as proof. Grep every site
   of the limit constant (`grep -rn kMaxTypeNestingDepth source/`) and check
   whether any of them lies on the *mandatory* path to your new code. Per-walker
   `recursionDepth` parameters are a strong tell that each walk guards only
   itself. Also separate the *cyclic* case (often genuinely rejected) from the
   *deep-but-acyclic* case (usually not).

## Fix

- Reversed the call to WITHHELD; it became the principal abstain ground.
- Generalizable rule: **"an earlier diagnostic rejects this" needs the mandatory-path
  proof, not just the diagnostic's existence.** The prior learning's scope is "don't
  add a guard whose trigger is provably pre-empted" — it does not license a guard
  whose fallthrough *is* the bug.
- Corollary for reviewing any `if (depth >= CAP) return X;`: X must be justified
  in the comment by failure direction, not by an assertion about which programs
  are "valid".

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785745165071-approver-challenger-miss-a-depth-recursion-cap-tha.md`_
