---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789136060057-ex6aw0
written_at: 2026-10-30T21:34:35.127Z
---

# Slang: filtering initializers through optional constraints needs cache gating and a diagnostic

When you make a front-end lookup result depend on the enclosing `if (T is I)` (as `filterLookupResultByCheckedOptional` does), audit every cache keyed only by type that consumes it. In shader-slang/slang PR #14096, filtering `lookupConstructorsInType` results broke two things, and both were fixed:

- **Default initialization.** `T x;` default-init (slang-check-decl.cpp) and `_coerce` (slang-check-conversion.cpp) cache initializer choices in `ImplicitCastMethodKey(fromType, toType)`, which has no statement context. A checked `T y;` earlier in the function decided the result for a later unchecked `T x;`, and in the other order `x` silently lost its `__init()`. Fix: skip the cache when either type conforms through an optional constraint. That check is cheap: test `_canLookupConstructorsThroughAbstractType`, then `findOptionalConstraintWitness` on each facet witness.
- **The diagnostic.** `AddTypeOverloadCandidates` is called from speculative JustTrying probes (a one-argument `T(x)` first goes through an explicit coercion with a collecting sink), so it must filter silently. Report what was filtered at the end instead: in the `ResolveInvoke` ExpectedFunction fallback, re-run the unfiltered lookup and call `filterLookupResultByCheckedOptionalAndDiagnose`. For `T x;`, re-run zero-argument resolution unfiltered and diagnose the applicable candidate(s); include `bestCandidates`, because two optional constraints can each provide a default initializer.

Also: `_calcInheritanceInfo`'s extension loop runs in rounds. If you change which proof `additionalSubtypeWitnesses` keeps, re-queue the interface when its proof is replaced in a later round, and skip extensions that already apply.

Testing tip: a full slang-test run with `-server-count 32` on a shared GPU produced about 100 false failures (VK_ERROR_OUT_OF_DEVICE_MEMORY / CUDA_ERROR_LAUNCH_FAILED). Re-run the failing files serially before you report suite numbers.
