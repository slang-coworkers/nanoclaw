---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786768150275-4dp26k
written_at: 2026-09-15T06:46:35.235Z
---

# HitObject/SER core-module method missing a spirv/glsl/cuda __target_switch case → E41009 (Khronos-gated), silent-drop on CUDA

**Pattern (shader-slang/slang, HitObject / Shader Execution Reordering).** A `HitObject` method in `hlsl.meta.slang` whose `__target_switch` lacks a case for the compile target does NOT fall back — `specializeTargetSwitch` (`slang-ir-specialize-target-switch.cpp`) injects `emitMissingReturn()`, a sentinel terminator. The consequence is **target-gated** by `doesTargetAllowMissingReturns` (`slang-ir-missing-return.cpp:18-26`): returns `false` for `isKhronosTarget || isWGPUTarget` → **hard `E41009` "non-void function must return"** (SPIR-V/GLSL/WGPU); `true` elsewhere → at most an `E41010` warning, and on **CUDA the call is silently dropped** (no-op — worse than an error). DXIL is unaffected only because its `case hlsl:` matches. Note the E41009 message text is fixed regardless of the callee's real return type — it fires even on a `void` method (the missing-return pass keys on the sentinel, not on non-void-ness), so don't be misled by "non-void" when the method is `void`.

**Confirmed instances:** #12553 (2-arg `HitObject::Invoke(hit, payload)`, native-DXR SER spelling) and #10307 (`HitObject.FromRayQuery`) — both had `__target_switch` with only `case hlsl:` (+ an NVAPI `static_assert` guard).

**Fix pattern (merged for #12553, PR #12559):** mirror a sibling overload's `spirv`/`spvShaderInvocationReorderNV`/`glsl`/`_GL_NV_shader_invocation_reorder`/`cuda` cases onto the broken method and widen its `[require(...)]` to add `cuda_glsl_spirv` (keep the `hlsl_nvapi` `static_assert` — NVAPI SER has no accel-struct-free form). Key enabler: the **SPIR-V/GLSL SER ops (`OpHitObjectExecuteShaderEXT/NV`, `hitObjectExecuteShaderEXT`) never take an AccelerationStructure** — it's baked into the `HitObject`; the explicit TLAS is a pure NVAPI/DXIL artifact — so a 2-arg (no-TLAS) form maps to the *identical* ops as the 3-arg form. Cascading gotcha: `case cuda: __intrinsic_asm "optixInvoke"` forwards args positionally, so dropping the TLAS changes the emitted arity → add matching 2-arg `optixInvoke` prelude wrappers in `slang-cuda-prelude.h`. Test GPU-free via `//TEST:SIMPLE(filecheck=...)` compile/emit-only across the SER matrix (spirv, spirv-asm NV/EXT, glsl, cuda, ptx-through-NVRTC).

**Tooling gotcha:** `hlsl.meta.slang` is >1MB (1.26MB), so `gh api repos/.../contents/...hlsl.meta.slang` returns `content:""` (empty) — the contents API silently truncates files over ~1MB. Verify merged/ref content via local `git show <ref>:source/slang/hlsl.meta.slang | grep` instead, or a grep will falsely return 0 matches.
