---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787247199408-te4uzb
written_at: 2026-08-20T17:57:33.385Z
---

# CORRECTION to slang #12659 root cause — it is the isComputing empty-facet re-entry, not the isBeingChecked skip

Corrects my earlier learning "Assoc-type-as-generic-arg loses conformance witness via order-dependent partial inheritance-info caching (slang #12659)". That note named `tryAddConstraintBase`'s `constraintDecl->checkState.isBeingChecked()` skip (`slang-check-inheritance.cpp:~1117`) as the failing branch. A subsequent runtime-confirmed trace (instrumented Debug build) shows that was WRONG.

**Actual mechanism:** the failing branch is the in-progress **`isComputing` re-entry guard** in `SharedSemanticsContext::_getInheritanceInfo` (`slang-check-inheritance.cpp:280-287`): when a cache lookup finds `found->isComputing == true` it returns `found->info`, seeded EMPTY at :292-296. During interface header-checking there is one outer `getInheritanceInfo(Context)` frame in flight; `Context`'s `IContext` base is discovered by the assoc-type-access scan (:1099-1210) into LOCAL builders and written to the cache only at frame COMPLETION. Every `isSubtype(Context,IContext)` that fires while that frame is on the stack re-enters, gets `facets=[]`, returns null → E38029 (`slang-check-overload.cpp:1278/1303`).

**Why the first use survives:** it is resolved by the fixpoint-solver path (`slang-check-overload.cpp:~1230-1248`) that returns BEFORE the diagnosing per-constraint loop; subsequent uses fall through to the loop and diagnose on the transiently-empty result. It is re-entrancy during one in-progress frame, NOT "first use caches something the second reuses."

**Also corrected:** the subtype-witness cache (`m_mapTypePairToSubtypeWitness`) is NOT involved — it never caches the null (`cacheSubtypeWitness` bails at generation 0) and only caches the correct witness after completion. My earlier "coupled caches" hypothesis was wrong.

**Fix direction:** don't treat an empty in-progress (isComputing/generation-0) inheritance result as authoritative "no such base" for a conformance query — either populate the constraint-derived bases before re-entrant queries, or have `isSubtype`/`checkAndConstructSubtypeWitness` treat it as "unknown, defer" (mirroring the existing frameSkipped/partial-uncacheable machinery). PR #11368 §5.4 ("Caching during the checking window") names this as a known follow-up; #12659 is that limitation manifesting.

**Process lesson:** a static-read triage that pins a plausible-but-adjacent guard can be wrong about WHICH branch fires; a runtime trace (even just fprintf in a Debug build) is what disambiguates re-entrancy bugs. Ship the correction to the fixer AND the shared record even after handoff — the wrong guard would have sent the fix to the wrong place.
