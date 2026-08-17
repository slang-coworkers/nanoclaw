---
title: "NRVO for opaque non-copyable returns must be scoped to opaque HANDLES, not all [__NonCopyableType]"
type: learning
topic: misc
source: learnings/1784798335581-nrvo-for-opaque-non-copyable-returns-must-be-scope.md
---

# NRVO for opaque non-copyable returns must be scoped to opaque HANDLES, not all [__NonCopyableType]

**Context:** shader-slang/slang#12197 — a plain function returning `RayQuery<...>` by value silently miscompiled on SPIR-V (OpRayQueryInitializeKHR on one var, Proceed() on a different uninitialized one → Vulkan/NVIDIA device-loss). Root cause (confirmed by disasm, not source-only): the return-destination transform DOES fire, but the callee value-copies the opaque handle into the destination via OpLoad+OpStore — a no-op for a non-copyable ray query. Fix = NRVO: alias the single named-return local to the return-destination parameter (slang-lower-to-ir.cpp) so the handle is built in place.

**The key lesson (cost me a full build cycle + 2 codex rounds):** gating NRVO on `isNonCopyableType` is TOO BROAD. `[__NonCopyableType]` is also worn by ordinary bit-copyable structs (`struct NC { int value; }`) whose by-value return works correctly TODAY. Aliasing those to the destination changes observable behavior and introduces regressions:
- **defer**: a deferred statement runs after the return value is chosen; if it mutates a local aliased to the dest, the returned value is corrupted (returns the deferred write, not the snapshot).
- **aliasing** (`x = f(x)` with `inout`): the return-dest can alias a by-reference arg; NRVO writes the dest incrementally through the body, corrupting the aliased arg. Non-NRVO writes it once at the end.
- **throws**: on a throwing path the `return` never runs, but partial writes to the aliased local already landed in the caller's slot → the caller's try/catch observes a value the failed call never produced.

**Fix:** scope NRVO to genuinely-opaque handles via a shared `isNonCopyableOpaqueType` (RayQuery/HitObject — the types where a whole-value load/store is a real no-op). This makes the regressions impossible by construction: opaque handles ALREADY miscompile the copy, so narrowing can't regress currently-correct behavior; and bit-copyable tagged structs keep the ordinary copying return path. Plus conservative bails: defer, throwing functions (`decl->errorType` non-bottom), and any other parameter sharing the opaque handle type (aliasing).

**Residual (deferred, maintainer decision):** bare `RayQuery b = a;`, field/aggregate destinations (`box.q = f()`), and NRVO-bailout paths all still emit the broken opaque copy — SAME as master (no regression), but NOT diagnosed. A copy-site diagnostic (Approach B) is warning-vs-error = non-breaking-vs-breaking policy, AND must avoid false-positives on out/inout arg passing (which legitimately emits identical OpLoad/OpStore). Surface this as a maintainer decision rather than bundling a risky diagnostic.

**Method notes:** (1) adversarial codex CODE_REVIEW caught both regressions in the first cut — a green broad test suite (2113 tests) did NOT, because it had no defer/aliasing/throws+rayquery coverage. Adversarial review > suite-green for soundness. (2) Guard REGRESSION TESTS must use the opaque type (RayQuery) and assert NRVO-OFF (callee keeps its own local at -O0); a non-opaque test never reaches the guard. Verify the contrast (same fn without defer/alias-param GETS nrvo). (3) The existing tests/bugs/gh-10774-concrete-return.slang was a FALSE-GREEN — it only checked both ray-query ops exist, never that they target the same var; assert same-var with a FileCheck capture+backref. Note OpRayQueryProceedKHR returns bool so its query operand is 2nd (`%bool %q`), Initialize is void so 1st.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784798335581-nrvo-for-opaque-non-copyable-returns-must-be-scope.md`_
