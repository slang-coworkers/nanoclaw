---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334321515-r8nnjm
written_at: 2026-08-21T21:22:53.013Z
---

# [approver/confirmed-safe] Interim target-capability static_assert guard: verify predicate precision, not just the merged-sibling pattern

**PR:** shader-slang/slang #12643 — "diagnose half-typed texture SampleLevel for the CUDA target". Decision: WOULD_APPROVE (Devin-only tier, human jkwak-work independently APPROVED). Class: interim compile-time diagnostic guarding a target-unsupported texel type in `hlsl.meta.slang` — the SampleLevel sibling of the merged #12303 half-`Load` guard.

**Shape (safe, transferable):** a `case cuda:` arm adds `static_assert(!__isHalf<T>(), "...")` above the texture-shape switch so one guard per method covers all shapes/array forms. This is safe when:
- The predicate folds PER-SPECIALIZATION (`__isHalf<T>()` is `kIROp_IsHalf`, an intrinsic op — `core.meta.slang:3931,3950` — NOT a `switch(T.kind)` constant), so it does NOT fire for a symbolic `T` at generic type-check. This is the #12185 trap (bare `static_assert(false)` fires unconditionally for symbolic T). **Always confirm the test has a generic-wrapper regression control that must compile clean.**
- `DIAGNOSTIC_TEST` is a recognized directive (`tools/slang-test/slang-test-main.cpp:749`) so each case is actually COLLECTED — a mis-spelled directive is silently skipped, so a diagnostic test can look present but never run. Each diagnosed width should have its OWN directive (diagnostic loss = a missing error, invisible to any codegen comparison).

**How to catch what the pattern-match misses (codex OUTPUT_REVIEW caught this twice):** matching the merged-sibling *mechanism* does NOT vet the *type-set wording*. #12303's "specialized only for float/uint/int" is TRUE for `tex*fetch_int` (Load's built-in) but FALSE when reused for `tex*Lod` (SampleLevel's built-in). Verified directly against `/usr/local/cuda/include/texture_indirect_functions.h`: `tex*Lod<T>` returns `__nv_itex_trait<T>::type`, and `__nv_itex_trait` is specialized for char/signed char/unsigned char/short/ushort/int/uint/float (+1/2/4-vector forms; long/ulong only when `__LP64__` unset) — but NOT `__half`. So "only float/uint/int" is imprecise (char/short/int also work). This was advisory-severity for the DECISION: the guard rejects exactly the half family (correct, no over-broad rejection), the user-facing message is accurate, and I'm read-only (can't edit PR text). But it is a genuine nit worth surfacing, and it does NOT get a free pass just because the sibling PR used the same phrasing.

**Also caught:** don't say "only X is unsupported" when the underlying trait also lacks other families (double, 64-bit ints). State the guard's scope ("rejects the half family, which this PR targets") and note other unsupported families as a separate pre-existing gap.

**Scope call:** Sample/Gather share the identical latent gap but are out of the PR's declared SampleLevel scope — CLEARS advisory (pre-existing, no regression, disclosed in the PR body). Not OPEN_GAP.
