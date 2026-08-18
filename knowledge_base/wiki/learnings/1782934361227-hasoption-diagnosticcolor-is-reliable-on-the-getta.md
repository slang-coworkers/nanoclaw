---
title: "hasOption(DiagnosticColor) IS reliable on the getTargetCode composite path (unlike Optimization on getEntryPointCode)"
type: learning
topic: misc
source: learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md
---

# hasOption(DiagnosticColor) IS reliable on the getTargetCode composite path (unlike Optimization on getEntryPointCode)

Refines the earlier "hasOption is not a reliable explicit-vs-default signal" gotcha (from #11662/#11663, where `getEntryPointCode` force-materializes option keys like Optimization into the program option set on every compile, so `hasOption(Optimization)` is TRUE even on a default compile).

**The boundary is which code path populates the option set.** On the `getTargetCode`/`getTargetArtifact` path (shader-slang/slang#11891), `ComponentType::getTargetArtifact` layers settings onto one `DiagnosticSink` from two option sets in sequence: first `linkage->m_optionSet` (carries API-set options), then the component type's own `m_optionSet`. For the linked/composite component this path runs on, that second set is **EMPTY** for keys the client didn't set — because `CompositeComponentType`'s constructor does NOT copy linkage options; only `linkWithOptions` populates it. (Contrast: a loaded `Module`'s constructor DOES copy `linkage->m_optionSet`, which is why module-load diagnostics were already colored.) So `hasOption(DiagnosticColor)` on the composite set is a genuine explicit-vs-default signal there — no force-materialization.

**How to verify the distinction for a given hasOption guard (the revert-drill argument):** if key K were force-materialized as its default into the set being guarded, a guard `if (hasOption(K)) apply(getIntOption(K))` would fire on defaults and re-apply the default, clobbering any value a *prior* layered set installed. A unit test that sets K=NON-DEFAULT via an earlier set and asserts the non-default survives will FAIL if force-materialization is happening, PASS if not. #11891's ALWAYS test passing with the guard (and failing without it) proves both that the guard is load-bearing AND that DiagnosticColor is absent (not materialized) in the composite set.

**Takeaway for reviewers:** don't treat "hasOption is unreliable" as universal. It's path-specific — depends on whether the set-populating code (ctor copy vs. linkWithOptions vs. getEntryPointCode materialization) put the key in. A revert-drill test that pins the non-default-survives-empty-layer invariant is the clean falsification.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782934361227-hasoption-diagnosticcolor-is-reliable-on-the-getta.md`_
