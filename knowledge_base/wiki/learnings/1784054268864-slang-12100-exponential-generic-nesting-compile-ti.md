---
title: "slang#12100 exponential generic-nesting compile time: missing substitution/conformance memoization; >80x regression traces to #9808 autodiff refactor"
type: learning
topic: slang-compiler
source: learnings/1784054268864-slang-12100-exponential-generic-nesting-compile-ti.md
---

# slang#12100 exponential generic-nesting compile time: missing substitution/conformance memoization; >80x regression traces to #9808 autodiff refactor

## slang#12100 — exponential compile time with generic nesting depth (+ >80x v2026.5→v2026.8 regression)

**Symptom (REPRODUCED on ToT @3eeda847c, debug slangc).** Nested generic calls `wrap(wrap(...wrap(x0)...))` where `Wrapper<T> wrap<T:IModel>(T v)` and `struct Wrapper<T:IModel>:IModel` grow compile time exponentially: depth 8≈3.1s → 12≈11.7s → 14≈72s → 16 timeout. Same exponential class for `typealias Pair<Leaf,T_{i-1}>` chains and associated-type `T.Next.Next...` chains. Distinct secondary symptom: plain non-generic `f(f(...f(x)...))` at ~200 deep → `E39997 maximum type nesting level exceeded` (fine at 128).

**Root cause (hypothesis — code trace + DeepWiki, not profiled).** No memoization of the substitution/conformance work that each nesting level redoes for all inner levels:
- Type-check flow per call: `ResolveInvoke` (slang-check-overload.cpp:3375) → `inferGenericArguments` (:2866) → `trySolveGenericArguments` (slang-check-constraint.cpp:3406) → `buildSubstDeclRef` (:2777).
- `DeclRefType::_substituteImplOverride` (slang-ast-type.cpp:152-213) and `GenericAppDeclRef::_substituteImplOverride` (slang-ast-decl-ref.cpp:482) do NOT memoize substitution results — each layer re-descends & re-substitutes the whole `Wrapper<Wrapper<...>>` tree.
- `GenericAppDeclRef` IS interned via `ASTBuilder::getOrCreate` (`m_cachedNodes`, slang-ast-builder.h:485/223) but the `ValKey` is keyed by operand POINTER identity, so structurally-identical substituted types at different levels are pointer-distinct and miss the cache.
- A subtype-witness cache DOES exist (`SharedSemanticsContext::m_mapTypePairToSubtypeWitness`, `cacheSubtypeWitness`/`tryGetSubtypeWitnessFromCache`, slang-check-inheritance.cpp:95-137) — but it's GENERATION-GATED (only caches when both endpoints' inheritance-info generations are non-zero, i.e. fully computed). Nested/mid-computation substituted types bypass it, so `Wrapper<T>:IModel` is re-proven per level → multiplicative blowup.

**E39997** is a SEPARATE facet: `kMaxTypeNestingDepth=128` (slang-check.h:21), diag def slang-diagnostics.lua:3384, emit sites slang-check-shader.cpp:413/608/1312 — a type-STRUCTURE traversal guard, not a call-expression counter. It fires when a synthesized/return type's structure nests >128, not on call depth per se.

**Regression window.** >80x v2026.5→v2026.8 (constant-factor jump ~7x at depth 16). Primary suspect (hypothesis, in-window VERIFIED via `git merge-base --is-ancestor`, NOT profiled): **#9808 "Refactor auto-diff implementation"** (`45ccce9a3`) — by far the largest front-end change in the 111-commit range, touches every per-level hot-path file (constraint solving, conformance, inheritance-cache invalidation). Contributing: #10748 (`56e13abad`, __hasDiffTypeInfo constraint), #10803 (`ee9587df0`, a PARTIAL compile-time recovery for the same overhaul — self-describes as restoring core-module compile time). Decisive proof step = first-parent bisect `45ccce9a3^` vs `45ccce9a3` on the depth-16 repro.

**Triage disposition.** Reporter jvepsalainen-nv (NVIDIA CONTRIBUTOR) self-assigned AND authors PR #12086 (the compile-perf depth-axis benchmark tracking — `generic_nesting`/`generic_nesting_eval`/`interface_depth` — this issue feeds). Parent parked HOLD-for-assignee (no fixer dispatch): high-blast-radius core-substitution refactor + unprofiled regressor + owner-driven workstream. Same pattern as #12096 (same reporter, self-assigned, parked). Labeled reproduced+regression, Type=Performance, verdict comment 4972584693. No true duplicate; #11776 (CLOSED, O(N²) specializeModule — breadth axis) and #11897 (CLOSED, sema_generics slow — v2026.7-era) are siblings from the same compile-perf cluster.

**Meta-learnings that saved time:**
1. GitHub App installation token: `gh api user` → 403 "Resource not accessible by integration" is NORMAL (Apps can't hit /user), and REST `POST .../labels` → 403 "Must have admin rights" — but **GraphQL mutations work** (`updateIssue` for Type, `addLabelsToLabelable` for labels, `addComment` for the verdict). When REST write 403s for a bot, retry via GraphQL.
2. Repo has a native **Performance** Issue Type: `IT_kwDOAb2kZs4BlAhg` (full list also has Refactoring/Build/Testing/Language Maturity/DevRel/Documentation). Use it for compile-time/runtime perf bugs instead of forcing Bug.
3. `addLabelsToLabelable` needs the label IDs INLINE in the query string (`labelIds:["id1","id2"]`); repeated `-f labels=` CLI flags do NOT build a GraphQL list and error "unexpected override existing field".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784054268864-slang-12100-exponential-generic-nesting-compile-ti.md`_
