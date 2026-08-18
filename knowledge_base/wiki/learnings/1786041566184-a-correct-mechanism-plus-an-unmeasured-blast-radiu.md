---
title: "A correct mechanism plus an unmeasured blast radius still yields the WRONG remedy — measure a cache's LIFETIME before designing around it; a type named 'Shared' is not compile-wide"
type: learning
topic: misc
source: learnings/1786041566184-a-correct-mechanism-plus-an-unmeasured-blast-radiu.md
---

# A correct mechanism plus an unmeasured blast radius still yields the WRONG remedy — measure a cache's LIFETIME before designing around it; a type named "Shared" is not compile-wide

## The situation

Adding a warning to Slang's `_coerce` (issue #12284), I found that its conversion cache short-circuits
overload resolution: on a cache hit `bestCandidate` is populated directly and
`AddTypeOverloadCandidates` is skipped, so a hook that records candidates never runs. Mechanism
verified in source, correctly.

I then designed two fixes and **reverted both**:
1. Re-run `AddTypeOverloadCandidates` on the cache-hit path — overwrites the cached winner, defeating
   the cache entirely.
2. Recover the discarded candidate with a fresh `lookupConstructorsInType` — reconstructs state the
   producer threw away, i.e. the *"context rediscovery by graph walking"* smell.

**The missing measurement was the cache's LIFETIME.** `Dictionary<ImplicitCastMethodKey,
ImplicitCastMethod>` is a member of `SharedSemanticsContext`, and the key has no module or call-site
component — which reads like a compile-wide cache. But the construction site settles it:

```
slang-check.cpp:184  void checkTranslationUnit(TranslationUnitRequest* translationUnit, …)
slang-check.cpp:187      SharedSemanticsContext sharedSemanticsContext(
                             …->getLinkage(), translationUnit->getModule(), …);
```

A **stack local in the per-translation-unit entry point**, destroyed when the TU finishes, called once
per TU from a loop (`slang-compile-request.cpp:513`). So the cache cannot outlive one module, and
"module P's entry silences module Q" is **structurally impossible**, not merely unobserved.

⇒ The real impact was not "silently fails to warn" but "warns **once per conversion shape per
module** instead of once per call site" — i.e. **de-duplication of one hazard**, which is desirable and
consistent with the `diagnoseOnce` behaviour already used for repeated resolutions of one call. Both
reverted fixes would have added machinery *to produce more duplicate warnings*, and would likely have
passed review as diligent.

## The rules

⭐ **Measure the scope of a mechanism before designing the remedy.** A verified mechanism plus an
unmeasured blast radius still gets you the wrong fix. For a cache specifically, the questions are:
*where is it constructed, what is its lifetime, and what is the key?* — in that order. The key alone
tells you what collides; only the lifetime tells you *who* collides.

⭐ **A type's name is not its lifetime.** `SharedSemanticsContext` sounds compile-wide and is per-TU on
the checking path. (The one long-lived instance is `Linkage::m_semanticsForReflection`, constructed
with `module = nullptr` — the reflection path, not checking.) Same failure class as inferring
suppression from name resolution: read the construction site, not the identifier.

⭐ **Two consecutive fix attempts that each make it worse is the signal to stop and re-derive**, not to
try a third. Reverting both and re-measuring cost one command and settled the question.

⭐ **A reviewer's hedged phrasing about a mechanism is often a finding they didn't fully chase.** Codex
wrote "with care around cached conversions"; I read it as a caution and it named a real second defect.
Treat a hedge about a specific mechanism as an unexplored lead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786041566184-a-correct-mechanism-plus-an-unmeasured-blast-radiu.md`_
