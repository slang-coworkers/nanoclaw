---
title: "slang#13061: optional-constraint super-interface conformance is a flattened InheritanceDecl witness at HEAD (Approach A / transitive-descent is stale)"
type: learning
topic: slang-compiler
source: learnings/1789651782494-slang-13061-optional-constraint-super-interface-co.md
---

# slang#13061: optional-constraint super-interface conformance is a flattened InheritanceDecl witness at HEAD (Approach A / transitive-descent is stale)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789383381900-1pnntc
written_at: 2026-09-17T13:29:42.494Z
---

# slang#13061: optional-constraint super-interface conformance is a flattened InheritanceDecl witness at HEAD (Approach A / transitive-descent is stale)

**Context:** shader-slang/slang#13061 — `where optional T : __BuiltinIntegerType { return a+b; }` type-checks with no diagnostic (soundness leak); sibling ICE #13011. Triage (at HEAD `d3a113484`) root-caused it to `isWitnessUncheckedOptional` (`slang-check-expr.cpp:1315`) missing a `TransitiveSubtypeWitness`, with fix = descend `TransitiveSubtypeWitness::getSubToMid()` to the sub-most leg (Approach A).

**Finding (verified at HEAD `8d763dd390` by instrumenting `isWitnessUncheckedOptional` + rebuild):** Approach A is a **complete no-op** at this HEAD. Traced every witness the function receives for `a+b`:
- The witness overload resolution consults for `T : IArithmetic` / `T : __BuiltinArithmeticType` is a **bare `DeclaredSubtypeWitness`** (`as<TransitiveSubtypeWitness>` == null), whose `declRef` is the interface's **`$inheritance` `InheritanceDecl`** (parent = `__BuiltinArithmeticType`). `DeclaredSubtypeWitness::isOptional()` returns false because that decl is not a `GenericTypeConstraintDecl`.
- The optional modifier lives **only** on the direct `T : __BuiltinIntegerType` `GenericTypeConstraintDecl` (parent = the user function). The super-interface conformance is **flattened** and drops the optional-ness.
- There is **no `TransitiveSubtypeWitness`** anywhere in the resolution path, so `getSubToMid()` descent does nothing.

**Implication / lesson:** (1) The IR/AST witness representation for a generic param's inherited-interface conformance changed between `d3a113484` and `8d763dd390` (transitive → flattened `$inheritance`-backed `DeclaredSubtypeWitness`). **Always re-verify a triaged root cause against the CURRENT checkout by instrumentation, not the memo — witness shapes drift.** (2) The correct fix requires a layer decision: producer-side (preserve optionality when the inheritance linearization flattens a generic param's indirect-base conformances, or compose them transitively so the optional leg surfaces) vs consumer-side (recurse `isWitnessUncheckedOptional` through the flattened witness's base-conformance provenance — a graph-walk, methodology red flag). Not a one-liner.

**Cheap-repro tip:** the prebuilt master `slangc` reproduces the leak (exit 0) and the #13011 ICE (`E99997 ... Unexpected context type for parameter info retrieval`, `-target spirv`) GPU-free — no need to build first to confirm the bug. `SLANG_ASSERT=release-assert-only` avoids the abort dialog for the ICE.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789651782494-slang-13061-optional-constraint-super-interface-co.md`_
