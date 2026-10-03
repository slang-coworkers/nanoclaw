---
name: feedback_an_enumeration_is_not_a_proof_audit_the_quantifier
description: "A correct, complete enumeration of current call paths is not a proof over all paths — 'unreachable' / 'by construction' / 'proof' is the word that erases the difference, and no evidence check can see it. Audit the quantifier separately from the facts. Model form: say what the enumeration covers, what it doesn't, and what would invalidate it. Also: verifying the CITED lines is not verifying the claim — read the function being edited (#12330, 2026-08-06)."
metadata:
  node_type: memory
  type: feedback
---

# An enumeration is not a proof: audit the quantifier

**2026-08-06, slang#12330 / PR #12412.** Split from
[[feedback_an_enumeration_claim_needs_a_computed_complement]]; chain record:
[[project_12330_entrypoint_throws_not_diagnosed]].

## The scope word was the defect

slang-triager closed a gap by walking two closed sets. Both decl-less entry-point factories
(`createDummyForDeserialize`, `createDummyForPassThrough`) end in `CompositeComponentType::create`, and
`validateEntryPoint`'s only two callers both construct via `EntryPoint::create`. I verified both legs at
`d7d59f374` and strengthened one: `EntryPoint::create` dereferences the decl twice (`getName()`,
`getMangledName(...)`), so a decl is what it structurally *requires*, not just what it accepts.

⛔ It went out as "a reachability proof" and "unreachable by construction". Two closed sets support only:
*no decl-less `EntryPoint` reaches `validateEntryPoint` on the paths that exist at `d7d59f374`*. A third
caller added later falsifies "unreachable".

⭐⭐⭐ **Nothing was wrong with the evidence or the join; the defect lived entirely in the quantifier**, which
a control, a complement, and a re-measurement all pass. ⇒ **Read the sentence, not the world: audit the
quantifier separately from the facts it quantifies.** This is the twin of an unverified *inference* joining
verified facts ([[feedback_a_helper_choice_needs_the_arm_that_distinguishes_it]]): two ways to be wrong
with nothing false in the evidence.

⚠️ It was not caught before publication: "unreachable by construction" was already live in the PR body when
the triager flagged it. Its note: *"caught in time, but that was luck of timing rather than process."*
⭐⭐ **A correction that beats a reviewer to the artifact is a race you won, not a process.** In a merged body
the over-scoped word licenses a future editor to add a third caller believing the check covers it.

✅ Fixed in the live body at head `eb4cd103b972` (`unreachable` → 0, `by construction` → 0, control → 1).
The model form, worth copying:

> *"No decl-less `EntryPoint` reaches this check **on the paths that exist at `d7d59f374`**. This is an
> enumeration of current paths rather than a guarantee: a future third caller of `validateEntryPoint`
> could pass anything, so the check would need revisiting alongside such a change."*

It names what the enumeration covers, what it does not, and the event that would invalidate it.

## ⛔ My "load-bearing" upgrade was refuted inside the same function

I then endorsed and recorded a stronger framing: `DeclRef::getDecl()` can return null and
`slang-syntax.h:461` dereferences it unguarded, so the enumeration "licenses omitting a guard". Reviewer A
refuted it; verified at `7b4a8e931f3a`:

```
:1699  auto entryPointFuncDecl = entryPoint->getFuncDecl();
:1727  auto entryPointName = entryPointFuncDecl->getName();   // DEREFERENCE, unguarded
:1737  if (!getErrorCodeType(astBuilder, entryPoint->getFuncDeclRef())…  // the new check
```

A decl-less `EntryPoint` faults at `:1727`, ten lines **before** the new predicate. The precondition is
pre-existing and the check adds no null-deref surface. That claim is both correct and stronger: it holds
whatever a future caller does, so it needs no enumeration.

⭐⭐⭐ **I read the two cited lines (both correct) and never read the eight lines above the hunk.** The
deciding code was in the function being edited, not a distant header. Verifying the cited lines is not
verifying the claim. Every wrong version had precise, correct citations, and precision is what made each
one travel.

✅ What survived: the triager told the fixer **not** to add a defensive guard. `validateEntryPoint`'s
contract is a decl-bearing entry point, and a guard never hit under correct input is dead code masking a
future producer bug, which the project methodology rejects. Keep that answer ready if a reviewer asks.
