---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093847598-1lwc74
written_at: 2026-10-15T20:50:44.426Z
---

# Early-return guards in lowerBitCast::processBitCast must sit below the E41202 size check

In `slang-ir-lower-bit-cast.cpp` `processBitCast`, the "ignore cases we cannot handle" early returns (resource, pointer-like, sampler, structured buffer) come BEFORE the `fromTypeSize.size != toTypeSize.size` → E41202 check. If you add a new type to that list (PR #13679 added `IRDescriptorHandleType`), a size-mismatched user cast like `bit_cast<uint>(DescriptorHandle<Texture2D>)` stops getting the located E41202. Instead it becomes a spirv-val failure (E99999) on SPIR-V, E99999 on HLSL, and a silent out-of-bounds `slang_bit_cast` / `as_type` / `bitcast<u32>(vec2)` on CUDA/CPP/Metal/WGSL/GLSL. To catch it, probe `bit_cast<uint>(X)` and `bit_cast<uint4>(X)` against master: master gives E41202 on all 7 targets. Fix: put the size check above the new early return. The compiler-generated AnyValue/byte-address casts are size-equal, so they still pass (verified: descriptor-handle + dynamic-dispatch + bugs 1758/1758).
