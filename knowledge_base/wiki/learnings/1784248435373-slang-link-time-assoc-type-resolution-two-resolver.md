---
title: "slang link-time assoc-type resolution: two resolvers differ on TransitiveSubtypeWitness (#12134)"
type: learning
topic: slang-compiler
source: learnings/1784248435373-slang-link-time-assoc-type-resolution-two-resolver.md
---

# slang link-time assoc-type resolution: two resolvers differ on TransitiveSubtypeWitness (#12134)

When triaging link-time `export`/`extern` wrapper associated-type resolution in Slang (the #9580 / #12131 / #12134 cluster), there are **two distinct requirement-resolution entry points that behave differently on transitivity** — this is load-bearing for any base-interface / transitive fix:

- `tryLookUpRequirementWitness` (`source/slang/slang-syntax.cpp:716`) **DOES** decompose `TransitiveSubtypeWitness` — explicit `as<TransitiveSubtypeWitness>` branch at `:805-826` (recurses on `subToMid`, looks the requirement up in the mid-table).
- `getUnspecializedLookupRec` / `LookupDeclRef::tryResolve` (`source/slang/slang-ast-decl-ref.cpp:260-354`) **does NOT** — single `witnessTable->getRequirementDictionary().tryGetValue(...)` on one resolved table, no transitive branch. There is even a `// TODO: should handle the transitive case here too` at `slang-syntax.cpp:844`.

`resolveLinkTimeAssociatedType` (`slang-type-layout.cpp:6514`, the #9580 fix) resolves via `DeclRefType::create(...)->resolve()` → routes through the **non-transitive** path. So the "compose a `SolidMode : IFragBase` transitive witness then resolve" suggestion (#12134's body) only works if the fix ALSO routes through `tryLookUpRequirementWitness` (or teaches the decl-ref path the transitive case). Naively composing a `TransitiveSubtypeWitness` and calling `->resolve()` still misses.

Also: `getInheritanceInfo(type).facets` already carries **canonically-composed transitive base subtypeWitnesses** with diamond/multi-inheritance ordering resolved by facet (C3-style) linearization at construction (`slang-check-inheritance.cpp:640-758`, re-root loop `:2036-2050`). So "which base path to compose" (the diamond worry #12131 deferred) is arguably already answered by the facet list — look up the facet whose `subtypeWitness->getSup()->equals(interfaceType)` rather than hand-composing.

**Method lesson:** DeepWiki conflated the two resolvers (claimed `getUnspecializedLookupRec` handles the transitive case — FALSE). Always verify a "resolution handles X" claim against the actual entry point the code-under-test uses, not the generically-named one.

**Verification tip:** the #9580 fix (PR #12131) was an OPEN DRAFT, not merged — so plain `master` crashes on BOTH direct and base cases. To prove #12134 is a genuine residual (direct fixed / base broken), you must build slangc from the PR branch. Differential result (branch `b9d1f8c39`): direct EXIT 0, base still aborts at `slang-ir-glsl-legalize.cpp:2166 structTypeLayout`. Changed files don't touch `.meta.slang`/`.lua`, so a plain incremental `cmake --build --preset debug --target slangc` suffices — no core-module/fiddle regen.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784248435373-slang-link-time-assoc-type-resolution-two-resolver.md`_
