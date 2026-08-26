---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787679061103-lqxsh6
written_at: 2026-08-25T18:12:04.479Z
---

# [approver/challenger-miss] Reachability proof must cover recursive/synthesized-key call paths, not just the direct external caller

## Symptom
On shader-slang/slang PR #12752 (`tryLookUpRequirementWitness` gains a branch that early-`return`s an empty witness on a `none` lookup, before the function's `ThisTypeConstraint` fallback), I initially derived WOULD_APPROVE by arguing the skipped-fallback divergence was UNREACHABLE. My proof: the new branch fires only for a lookup-backed `DeclaredSubtypeWitness`; the fallback fires only for a `ThisTypeConstraint(Decl)` key; the sole EXTERNAL caller filters keys via `declRef.as<AssocTypeDecl>()` and neither ThisType class is an `AssocTypeDecl`. The DECISION_REVIEW codex critique returned must-fix and refuted it.

## Root cause
The `AssocTypeDecl` filter guards only the **direct external caller**. The same function has a **transitive branch** that RECURSIVELY re-invokes itself with a *synthesized* requirement key (`midKey.getDecl()` = the mid→sup `DeclaredSubtypeWitness`'s declRef). And `SemanticsVisitor::getThisTypeWitness` (slang-check-decl.cpp:~14504) explicitly CONSTRUCTS a `DeclaredSubtypeWitness` whose declRef is a `ThisTypeConstraintDecl`. So the "impossible" pairing (lookup-backed witness + ThisTypeConstraint key) is a plausible INTERNAL shape my caller-filter argument never touched. I proved unreachability for the front door and implicitly assumed it held for every internal re-entry.

## How to catch it
When clearing an "early-return changes control flow" gap by an unreachability argument, ENUMERATE EVERY ENTRY into the function, not just the external API caller:
1. Direct external callers (filtered? by what predicate?).
2. **Self-recursion inside the function** — does it forward the same key, or SYNTHESIZE a new one? A synthesized key defeats any filter proven on the original.
3. Whether the "impossible" key/witness combination is CONSTRUCTED anywhere (grep for `getOrCreate<...Witness>` / `create<...>` with the type you claimed can't occur). If a construction site exists, the burden flips to proving that instance never reaches the function.
A "mirror of an existing function X" argument does NOT transfer X's safety unless X has the SAME contract and fallbacks — verify, don't analogize.
Green CI does not refute a missing-witness on an uncommon internal lookup: it "could not have come out otherwise" (structural blindness). Conservative-lean ⇒ a plausible-but-unproven divergent path is OPEN_GAP (ABSTAIN), not a clear.

## Fix
Corrected to ABSTAIN_POLICY(OPEN_GAP). The general rule: an unreachability clear is only as strong as its WEAKEST call path; recursion with a re-derived argument, and any construction site for the "impossible" shape, are the two places the front-door filter silently fails to cover.
