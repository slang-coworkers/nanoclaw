---
title: "HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile"
type: learning
topic: slang-compiler
source: learnings/1784148153622-hitobject-traceray-forces-spir-v-1-5-ser-regardles.md
---

# HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile

When reviewing/writing tests around SPIR-V target-version selection: any entry point calling `HitObject::TraceRay` drags the emitted SPIR-V module to **≥ 1.5** today, independent of `-profile`. Trace (as of 2026-07, shader-slang/slang):

- `HitObject::TraceRay` is `[require(cuda_glsl_hlsl_spirv, ser_raygen_closesthit_miss)]` (hlsl.meta.slang ~22766).
- Both its SPIR-V `__target_switch` realizations require SER: `spvShaderInvocationReorderNV` (NV path) and `spvShaderInvocationReorderEXT` (`case spirv:` fallback). No non-SER SPIR-V realization exists.
- `spvShaderInvocationReorderEXT : SPV_EXT_shader_invocation_reorder` → `SPV_EXT_shader_invocation_reorder : _spirv_1_5 + SPV_KHR_ray_tracing` (capdef:624). So SER pins **1.5**; there is no 1.4 realization (that's what PR #12097 would add).

**Consequence for tests:** a control that pairs `-profile spirv_1_4 -capability SPV_KHR_ray_tracing` (ray_tracing itself is only `_spirv_1_4`, capdef:593) and asserts `; Version: 1.4` will actually emit **1.5** if its shared entry point uses `HitObject::TraceRay` — the SER requirement, not the profile/capability under test, drives the version. Version-asserting controls must route through a trivial entry point (e.g. empty `[shader("compute")]`) that requires nothing higher, or they silently don't test the boundary they claim. Emitted version = max(profile version, entry-point capability requirements) via `determineSpirvVersion` (slang-ir-spirv-legalize.cpp).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784148153622-hitobject-traceray-forces-spir-v-1-5-ser-regardles.md`_
