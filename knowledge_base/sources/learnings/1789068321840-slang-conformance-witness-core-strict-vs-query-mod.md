---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789067653421-hiavgf
written_at: 2026-09-10T19:25:21.840Z
---

# Slang conformance-witness core, strict-vs-query mode, and Val-epoch map (as of master 928f4010f)

Reusable map for triage/feasibility work on Slang conformance witnesses, deferred checking, or the Val epoch (verified by direct read @ master 928f4010f). Surfaced during the #12995 "promise witness" feasibility investigation (PR #12690 thread).

**Conformance-witness search/creation is a single point:**
- `SemanticsVisitor::isSubtype(Type*, Type*, IsSubTypeOptions)` — decl `slang-check-impl.h:3248`, def `slang-check-conformance.cpp:51`. Returns `SubtypeWitness*` or **null; never diagnoses**.
- Builder `checkAndConstructSubtypeWitness(...)` — `slang-check-conformance.cpp:220`. Scans `getInheritanceInfo(subType).facets`; constructs via `m_astBuilder->getDeclaredSubtypeWitness` (:318) / `getOrCreate<DynamicSubtypeWitness>` (:360).
- Thin wrappers (all `isSubtype(..., None)`): `tryGetSubtypeWitness`, `tryGetInterfaceConformanceWitness`, `isTypeDifferentiable`.
- `IsSubTypeOptions` = `None`/`NoCaching` ONLY (`slang-check-impl.h:41-48`) — cache control, NOT strictness. `NoCaching` exists specifically to avoid caching *provisional* results that create circular deps.

**Strict-validation vs query distinction EXISTS but at the caller layer, NOT threaded into the witness core:**
- The core carries no mode/sink. The discriminator is `OverloadResolveContext::Mode { JustTrying, ForReal }` (`slang-check-impl.h:3347-3353`, default JustTrying :3408) + the "diagnose-on-null vs return-bool" convention (DeepWiki calls the underlying flag `shouldEmitError`).
- Named strict context "apply DeclRef<GenericDecl> to args" = `TryCheckOverloadCandidateConstraints` (`slang-check-overload.cpp:1157`); per-constraint demand `tryGetSubtypeWitness(sub,sup)` at :1278, strict gate applied AFTER null at :1300 (`if (context.mode != Mode::JustTrying)` → diagnose `TypeArgumentDoesNotConformToInterface`). Solver path demands `isSubtype` at `slang-check-constraint.cpp:2939-2943` (no diagnostic).
- ⇒ any design needing per-call-site strictness at the witness core must PLUMB the mode down (widely-called signature).

**Val epoch (global, on Session):**
- Counter `m_epochId=1` (`slang-global-session.h:216`), proxied `ASTBuilder::getEpoch()/incrementEpoch()` (`slang-ast-builder.cpp:438-446`, increment = `m_epochId++`).
- `Val::resolve()` (`slang-ast-val.cpp:72-94`) caches `m_resolvedVal`/`m_resolvedValEpoch` (`slang-ast-base.h:491-492`), stamps epoch BEFORE resolving (recursion guard); stale ⇒ re-resolve.
- **Only 3 `incrementEpoch()` callers**: ASTBuilder dtor (:242); after folding a defaulted-assoc-type witness (`slang-check-decl.cpp:3857-3859`); after conformance checking creates new witness tables (`slang-check-decl.cpp:11402-11405`, w/ TODO that global invalidation is coarse). Semantics = "a witness table we didn't have now exists → stale cached resolutions." Bumping on-demand is cheap and idiomatic; cost is coarse global invalidation.
- SEPARATE finer per-decl epoch for inheritance-info caching: `SharedSemanticsContext::bumpDeclExtensionEpoch` / `m_mapDeclToExtensionEpoch` (`slang-check-inheritance.cpp:22-27`) — NOT the Val epoch, same idiom.

**Deferred/lazy checking precedent:** `getInheritanceInfo` (`slang-check-inheritance.cpp:139-208`) marks `entry.isComputing=true` (:175); on a partial result (`frameSkipped != 0`) rolls the cache entry back (:201) so a later root query recomputes; propagates via `ioSkippedIncompleteFacet`. Session-lifetime worklists live on `SharedSemanticsContext` (`slang-check-impl.h:882`); per-visit copyable state on `SemanticsContext` (:1329). Front-end completion checkpoint = tail of `checkModule` (`slang-check-decl.cpp:5106`, ends :5327) / `checkTranslationUnit` post-step (`slang-check.cpp:200-202`, mirrors `_collectShaderParams`).

Note: subtype witnesses are hash-consed Vals **consumed at IR lowering**, not just type identity — any provisional/placeholder witness must `resolve()` to a concrete form and never reach lowering unresolved.
