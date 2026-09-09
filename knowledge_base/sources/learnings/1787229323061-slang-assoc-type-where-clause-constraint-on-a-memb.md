---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787225586591-dqlaqa
written_at: 2026-08-20T12:35:23.061Z
---

# Slang assoc-type where-clause constraint on a member is definition-order-dependent (#9785, #11368 §5.4)

**Symptom:** An interface requirement of the form `associatedtype A : IFoo<T> where A.Member : IBar<...>` can spuriously fail conformance with E38105 ("member does not match interface requirement") or E38029 ("type argument does not conform to interface"), and **swapping the definition order of the two conformers makes it compile**. Confirmed via repro on slangc 2026.13.1-50 (shader-slang/slang#9785).

**Root cause (facts, read from source):** Post-PR #11368 (commit 38c853dbe), both the `: IFoo<T>` inheritance-clause bound and the `where A.Member : ...` where-clause bound become **sibling `GenericTypeConstraintDecl`s** on the interface. The where-clause bound is validated during conformance by `isSubtype(constraintSub, constraintSup)` at `source/slang/slang-check-decl.cpp:10274` (constraint branch :10229-10343). A **multi-level (member-access) constraint subject** like `A.Member` is **deferred, not force-resolved** by `SharedSemanticsContext::tryResolveConstraintTypes` (`slang-check-inheritance.cpp:469-511`, `resolveLeafOrDefer` :493-501) and recorded via `ioSkippedIncompleteFacet` (frame partial/uncacheable). So the facet-**introducing** bound (`A : IFoo<T>`) must be checked before the facet-**consuming** where-clause; reversed/interleaved order leaves `A.Member` unresolvable because the introducer is skipped rather than forced. Negative subtype results are then cached (`cacheSubtypeWitness`, `slang-check-conformance.cpp:64`); the generation guard (`slang-check-inheritance.cpp:95-137`) only protects a stale inheritance snapshot, not incomplete conformance of the referenced struct.

**This is a KNOWN, documented limitation:** PR #11368's own commit body §5.4 tracks this order-dependence class as follow-up and names the principled fix — a **per-interface constraint-saturation (fixpoint) pass** (iterate resolving deferred member-of-assoctype constraints until no new facet appears) — instead of the current fixed single-pass ordering. §5.5 notes #9622 as adjacent.

**Triage rule:** when a conformance failure on an associated-type where-clause constraint is order-sensitive, don't chase the emit-site diagnostic — it's this deferral gap. Recommended fix is the fixpoint pass (Approach A); a narrower `ensureDecl(referenced, ReadyForConformances)` before `isSubtype` (Approach B) risks cycle diagnostics since such conformers typically reference each other mutually. Interim workaround: order facet-introducing conformers before facet-consuming ones. Which sibling diagnostic surfaces (38105 vs 38029) drifts by version — same underlying failure.
