---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787171048541-bvyf7c
written_at: 2026-08-19T20:40:18.498Z
---

# CUDA/OptiX TraceRay ray-flags are a bare intrinsic-asm pass-through (no validation)

**Bug class (shader-slang/slang#12629, verified at master 8dcc35a46):** For `-target cuda`, HLSL `TraceRay`'s ray-flags argument is emitted verbatim into `optixTrace(...)` with NO bit validation, so flags with no OptiX equivalent silently miscompile (exit 0, then a runtime GPU fault that reads like a null-ptr deref).

**Where:** `source/slang/hlsl.meta.slang:19751` — the CUDA arm of `TraceRay`'s `__target_switch` is literally `case cuda: __intrinsic_asm "optixTrace";`. No dedicated ray-tracing `kIROp`; the call lowers straight to an intrinsic-asm inst whose text is `"optixTrace"`, and the generic `__intrinsic_asm` path in `slang-emit-c-like.cpp` writes the operand as-is. `slang-emit-cuda.cpp` has ZERO `optixTrace`/`RayFlag` handling; the CUDA prelude wrappers (`prelude/slang-cuda-prelude.h:4666/:4692`) forward `RayFlags` into `::optixTrace` unmasked.

**The asymmetry that makes it subtle:** `OptixRayFlags` (OptiX 9.0, `optix_types.h`) defines only bits 0–7 (0x01..0x80). HLSL's low flags survive purely by bit-value coincidence with their OptiX counterparts. The high flags — `RAY_FLAG_SKIP_TRIANGLES`=0x100, `RAY_FLAG_SKIP_PROCEDURAL_PRIMITIVES`=0x200, `RAY_FLAG_FORCE_OMM_2_STATE`=0x400 — have no per-ray optixTrace equivalent (OptiX controls triangle/AABB skipping at the pipeline/traversable level). But those SAME flags ARE valid on the Vulkan/SPIR-V path (`hlsl.meta.slang:19772` feeds `$RayFlags` into `OpTraceRayKHR`; 0x100/0x200 = SkipTrianglesKHR/SkipAABBsKHR, ABI-identical). ⇒ the flags are meaningful; OptiX just can't express them per-ray ⇒ the correct fix is a **compile-time diagnostic**, not a bit translation.

**Feasibility of a fix:** the flag value constant-folds to an `IRIntLit` in the common case (`RAY_FLAG_A | RAY_FLAG_B` are `static const` → the repro shows literal `513U`). Read it with `as<IRIntLit>(inst->getOperand(N))` (returns null if dynamic) — idiom at `slang-emit-cuda.cpp:954` (SetOptiXPayloadRegister). A runtime-computed flags value can't be inspected at compile time. Emit-time "unsupported on this target" pattern to mirror: `getSink()->diagnose(..., Diagnostics::UnsupportedTargetIntrinsic)` at `slang-emit-cuda.cpp:845/:882/:934`. Diagnostic defs are Lua: `source/slang/slang-diagnostics.lua`, `err("unsupported-target-intrinsic", 55204, ...)` at :5613, next free emit code in the 55xxx range.

**Second, unreported hazard (hypothesis):** HLSL `CULL_OPAQUE`(0x40)/`CULL_NON_OPAQUE`(0x80) share bit values with OptiX `CULL_DISABLED_ANYHIT`/`CULL_ENFORCED_ANYHIT` but differ SEMANTICALLY — a distinct silent-wrong class beyond the ≥0x100 "no equivalent" flags. Confirm DXR-vs-OptiX flag semantics before deciding whether a fix should also cover these.

**Reusable meta-lesson:** any `case cuda: __intrinsic_asm "..."` bare pass-through in a `.meta.slang` `__target_switch` does zero operand validation — enum/flag arguments whose value space differs between HLSL/DXR and the OptiX/CUDA target are candidates for this same silent-miscompile bug. The check belongs in a CUDA-target IR pass or the emitter (value-dependent), NOT in the core module (`.meta.slang` can't diagnose a per-call runtime value).
