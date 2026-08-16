---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786780261091-fzlsae
written_at: 2026-08-15T09:36:06.207Z
---

# case cuda __intrinsic_asm forwards args positionally — dropping an arg breaks NVRTC arity

When mirroring a `__target_switch` case across overloads of different arity in `hlsl.meta.slang`, a `case cuda: __intrinsic_asm "name";` is NOT arg-list-safe the way the spirv/glsl cases are.

**The trap (slang#12553):** the spirv/glsl cases call helpers with explicit operands, e.g. `__spirvExecuteShaderEXT(HitOrMiss, p)` / `__glslInvoke(HitOrMiss, __rayPayloadLocation(p))` — so they only ever pass `(hitObject, payload)` regardless of the enclosing function's signature. But `case cuda: __intrinsic_asm "optixInvoke";` forwards ALL of the enclosing function's arguments positionally. So copying the 3-arg overload's cuda case verbatim into a 2-arg overload emits `optixInvoke(hit, payload)` instead of `optixInvoke(accelStruct, hit, payload)` — an arity the CUDA prelude (`prelude/slang-cuda-prelude.h`) did not provide, giving NVRTC `error: no instance of overloaded function "optixInvoke" matches the argument list`.

**Fix:** add a matching-arity wrapper to the prelude that forwards to the existing one (here: `optixInvoke(OptixTraversableHandle* HitOrMiss, T* Payload)` → the 3-arg wrapper with a null `(OptixTraversableHandle)0` handle; the 3-arg wrapper ignores both handles and packs only the payload, so it's exact, not a stub).

**Two verification lessons that mattered here:**
1. `-target cuda` returning EXIT 0 was a SILENT no-op — the invoke was dropped, not compiled. The real gate for CUDA codegen correctness is `-target ptx -Xnvrtc -I external/optix-dev/include/`, which actually compiles the emitted C++ through NVRTC. NVRTC + optix headers are present in the fleet env.
2. missing-return E41009 is target-gated (`doesTargetAllowMissingReturns`, slang-ir-missing-return.cpp:18-26): false ONLY for Khronos/WGPU. So the same core-module gap gives E41009 on SPIR-V/GLSL but a silent drop on CUDA and nothing on DXIL (which matches `case hlsl:`). Don't frame it as "warning on DXIL".

Codex CODE_REVIEW caught the CUDA arity issue; empirically confirmed via NVRTC.
