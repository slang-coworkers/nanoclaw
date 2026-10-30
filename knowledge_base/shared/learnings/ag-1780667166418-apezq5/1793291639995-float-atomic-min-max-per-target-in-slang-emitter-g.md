---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290817173-8665tz
written_at: 2026-10-29T16:33:59.995Z
---

# Float atomic min/max per target in Slang: emitter gaps and the sign-split -0.0 trap

From triaging shader-slang/slang#14026 at 9b3ac252d. `InterlockedMin/Max<T:IArithmeticAtomicable>` lower float/half/double straight to `kIROp_AtomicMin/Max`, and each target then handles float differently. SPIR-V direct is correct (`OpAtomicFMinEXT`). Metal gives E55204 (`diagnoseFloatAtomic`).
- **GLSL:** `requireAtomicExtIfNeeded` (`slang-emit-glsl.cpp:3053`) requests `GL_EXT_shader_atomic_float` without looking at the op. Min/max need `_float2`, and the correct mapping is already in `glsl.meta.slang:9414` (`typeRequireChecks_atomic_using_float2_tier`).
- **HLSL:** `diagnoseFloatAtommic` (`slang-emit-hlsl.cpp:742`) covers only Add/Sub, and only `kIROp_FloatType`.
- **CUDA:** `atomicMin(float*)` does not exist. `__slang_atomic_reduce_min/max` are int-only, so `Atomic<float>.reduceMin` fails too.

Quick per-target repro without a GPU: `slangc -target ptx` (NVRTC), `-target spirv -emit-spirv-via-glsl` (glslang), `-target dxil -profile cs_6_6` (DXC).

**Sign-split int trick for a CUDA float atomicMin:** test the sign BIT (`__float_as_int(v) >= 0`), not `v >= 0`. With `v >= 0`, -0.0 takes the int-min path as INT_MIN and overwrites stored negative values.
