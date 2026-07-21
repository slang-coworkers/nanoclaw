---
title: "[approver/challenger-miss-averted] disabling a core-module init overload breaks bundled slang-rhi submodule shaders that test-slang never compiles"
type: learning
topic: slang-compiler
source: learnings/1784270927259-approver-challenger-miss-averted-disabling-a-core-.md
---

# [approver/challenger-miss-averted] disabling a core-module init overload breaks bundled slang-rhi submodule shaders that test-slang never compiles

**Symptom:** PR #12141 disabled the `vector<T,4>` 3-element initializers `(vector<T,2>,T)` / `(T,vector<T,2>)` by adding `static_assert(false)` `__init` overloads to `core.meta.slang`. The PRIMARY bot review (github-actions[bot]) verdict was 🟡 APPROVE_WITH_NITS (0🔴; the only "gap" was a breaking-change *label* suggestion) and Devin was clean (0 bugs). Every `test-slang` compiler-suite CI job was green. A naïve approver would have read verdict=APPROVE_WITH_NITS + all-clauses-pass → WOULD_APPROVE. That would have been a **false-safe**.

**Root cause of the miss:** the change is not confined to the PR's own new tests — it changes the core-module contract for *every* consumer. The bundled `external/slang-rhi` submodule ships its own test shaders that `test-slang` does NOT compile; only the separate `test-slang-rhi` integration jobs do. `test-ray-tracing-clusters.slang:74` has `float4(attribs.barycentrics, 1.f)` where `attribs.barycentrics` is `float2` (from `BuiltInTriangleIntersectionAttributes` in `hlsl.meta.slang`) — i.e. exactly the disabled `float4(vector<T,2>, T)` shape. So it now hits the new `E41400: static assertion failed, vector<T, 4> initializer requires 4 elements`, `createRayTracingPipeline` returns <0, the test throws. Neither the bot review nor Devin runs the slang-rhi suite, so both missed a deterministic, PR-caused hard compile break.

**How to catch it:** for ANY change to `core.meta.slang` / `hlsl.meta.slang` / prelude that *narrows* what compiles (disables an overload, tightens a coercion, removes an implicit conversion), the false-safe risk is downstream code that used the now-removed form. Do not trust combined-status (it showed `success` from 3 legacy contexts). Harvest **check-runs** at head: `test-slang-rhi` was RED (4 jobs: CUDA+Vulkan × Linux+Windows) + `check-ci` aggregate, while `test-slang` was green. Confirm PR-caused vs. infra by (1) checking the same job is GREEN on recent master (it was — visible recent master RHI runs green), and (2) reading the failing job log for the exact error — here the E41400 message is verbatim the one the PR introduces, on a `float4(float2, scalar)` line. `float4(float2, float)` / `float3(float2, ...)` style calls are common in real shader code; a "disable N-element vec init" PR must be assumed to break some of them until CI proves otherwise.

**Fix:** BLOCK (RED_BUG). A verified, deterministic, PR-caused compile break of a CI-gated pre-existing test is a RED bug even when the doc's verdict was APPROVE_WITH_NITS — the challenger may escalate to a verified bug (Step-3 rule: investigation adds caution). The proper landing path is to update the bundled slang-rhi shader to a 4-element form and bump the submodule (upstream first), or reconsider the hard-disable; rebasing onto master does not help because master's slang-rhi shader is unchanged. Same class/outcome as #11595, #12130, #12106-R1 (all challenger-CI-gate BLOCKs, all vindicated).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784270927259-approver-challenger-miss-averted-disabling-a-core-.md`_
