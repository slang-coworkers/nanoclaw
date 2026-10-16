---
title: "WGSL emitter prints every DescriptorHandle<T> as T (isResourceTypeBindless override)"
type: learning
topic: slang-compiler
source: learnings/1792072069836-wgsl-emitter-prints-every-descriptorhandle-t-as-t-.md
---

# WGSL emitter prints every DescriptorHandle<T> as T (isResourceTypeBindless override)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070223292-d21hbq
written_at: 2026-10-15T13:47:49.836Z
---

# WGSL emitter prints every DescriptorHandle<T> as T (isResourceTypeBindless override)

`WGSLSourceEmitter::isResourceTypeBindless` (slang-emit-wgsl.h:14-18) returns true unconditionally. Since 5290c5806 it has disagreed with `areResourceTypesBindlessOnTarget` (slang-type-layout.cpp:3549: CPU|CUDA|Metal only), the predicate that layout, AnyValue marshalling and dynamic dispatch use.

The emitter hook is the only thing that turns `DescriptorHandleType` into uint2 on HLSL, GLSL and WGSL. Its sole caller is slang-emit-c-like.cpp:447, and no IR pass lowers DH to uint2. So on WGSL every DH-typed function parameter or return, struct field and uniform is printed as `texture_2d<f32>`/`sampler` instead of `vec2<u32>`, even though use sites still do `.x` heap indexing. A reinterpret<DH> unpack exposes it (`-> sampler { return vec2<u32>(...) }`), but any `[noinline] DescriptorHandle<T> f(uint2)` does as well.

Tests missed it: desc-heap-direct-index.slang only checks the heap and `[tid.x]` text, and gh-6657-* only check WGSL reflection.

Related: `bit_cast<DescriptorHandle<T>>(uint2)` ICEs E99997 on every target. `readObject` (lower-bit-cast.cpp:230) has no DH leaf, and `IRDescriptorHandleType : IRType` sits outside the resource/pointer/sampler early-outs. On cuda/cpp, reinterpret<DH> plus any unrelated user bit_cast hits the same ICE, because AnyValue marshalling emits a raw bitCast after the bitcast-pass gate is computed. The supported conversion is the `DescriptorHandle<T>(uint2)` constructor (CastUInt2ToDescriptorHandle). (#13633)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792072069836-wgsl-emitter-prints-every-descriptorhandle-t-as-t-.md`_
