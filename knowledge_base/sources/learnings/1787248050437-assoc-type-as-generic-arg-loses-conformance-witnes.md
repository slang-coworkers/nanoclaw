---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787247199408-te4uzb
written_at: 2026-08-20T17:47:30.437Z
---

# Assoc-type-as-generic-arg loses conformance witness via order-dependent partial inheritance-info caching (slang #12659)

**Symptom:** An interface with `associatedtype Context : IContext; associatedtype First : IFirst<Context>; associatedtype Second : ISecond<Context>;` compiles the FIRST use of `Context` as a generic arg but fails the SECOND with `error[E38029]: type argument 'Context' does not conform to the required interface 'IContext'`. Reordering First/Second flips which one fails — the tell-tale signature of order-dependent partial caching.

**Root cause (shader-slang/slang, HEAD 2c6ca521d):** The `IContext` facet of the associated type `Context` is NOT intrinsic — it is synthesized by the constraint-surfacing scan in `slang-check-inheritance.cpp` (`tryAddConstraintBase`, ~:1100-1240), which walks the interface's sibling `GenericTypeConstraintDecl`s (post-PR-#11368 the `X : IFoo` bound lives at interface level, not nested in the AssocTypeDecl). That lambda SKIPS a constraint when `constraintDecl->checkState.isBeingChecked()` (~:1117) — a guard meant to break genuine multi-level-access cycles (`This.TA.TB`). But while the FIRST sibling bound is mid-check, `getInheritanceInfo(Context)` runs with the sibling still in-progress, so the *unrelated* `Context : IContext` constraint gets skipped, producing a PARTIAL facet list. `_getInheritanceInfo` (:341-357) caches a frame ONLY when `frameSkipped` is empty after removing self — so the partial `Context` frame is NOT cached. The SECOND use re-queries `tryGetSubtypeWitness(Context, IContext)` (`slang-check-conformance.cpp:51-66`), misses the cache, recomputes in the same skipped state → null witness → E38029 emitted at `slang-check-overload.cpp:1303` (`TryCheckOverloadCandidateConstraints`).

**Likely regressing PR:** #11368 "Unify associatedtype constraint representation" (commit 38c853dbe, 2026-06-09) — introduced the interface-level-constraint + partial-cache/isBeingChecked machinery. Its own test `assoctype-multiple-same-bound.slang` covers same-bound assoc types but NOT the assoc-type-used-as-generic-arg path.

**Triage-time gotcha:** the working tree at /workspace/agent/slang had UNCOMMITTED `SLANG_DBG_12659` fprintf instrumentation in slang-check-inheritance.cpp that a core dev (the reporter) had added — check `git status` before assuming HEAD == working tree, and never clobber another dev's in-progress debug edits. The instrumentation printed exactly `_getInheritanceInfo(Context) DONE complete=%d frameSkipped=%d`, which corroborated the partial-frame-not-cached root cause.

**Recommended fix direction:** scope the `isBeingChecked()` skip so a constraint is dropped only when its OWN subject is on the current in-progress inheritance chain, not merely because an unrelated sibling constraint is mid-check.
