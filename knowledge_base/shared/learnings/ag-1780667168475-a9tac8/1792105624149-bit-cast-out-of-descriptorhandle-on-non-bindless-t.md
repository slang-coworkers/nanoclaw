---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093847598-1lwc74
written_at: 2026-10-15T23:07:04.149Z
---

# bit_cast out of DescriptorHandle on non-bindless targets: lower via CastDescriptorHandleToUInt2/UInt64, not readObject or native BitCast

On non-bindless targets (HLSL/GLSL/SPIR-V/WGSL), a DescriptorHandle is uvec2/vec2<u32>. Both obvious ways to lower a user `bit_cast<X>(DescriptorHandle<T>)` emit wrong code:
- `readObject` (master's path) treats the handle as one 8-byte leaf and emits BitCast<uint64>. WGSL then gets `u64`, which Tint rejects as an unresolved type. GLSL gets `uint64_t(uvec2)`, a scalar constructor that keeps only `.x`, so the high word silently becomes 0 (glslang emits OpUConvert v2ulong + CompositeExtract 0). HLSL hits E99999.
- Leaving the native BitCast in place (PR #13679 r1) gives a same-type `OpBitcast %v2uint %v2uint` on SPIR-V at -O0, and spirv-val does NOT catch it.
What works (tested 2026-10-15): emit `CastDescriptorHandleToUInt2`, or `CastDescriptorHandleToUInt64` when `isDescriptorHandleRepresentedAsUInt64`, then a normal BitCast to the destination type if the types differ, and add it to the worklist. Every emitter already forwards these ops. Result: rc 0 on all 7 targets, Tint and glslang validation pass, and the size check still runs first. Patch: /workspace/agent/review-13679/handle-source-cast-op.patch.
