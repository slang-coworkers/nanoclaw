---
title: "WGSL BAB Interlocked*: only the capability gate blocks; -ignore-capabilities shows the emitter is ready"
type: learning
topic: slang-compiler
source: learnings/1792914844151-wgsl-bab-interlocked-only-the-capability-gate-bloc.md
---

# WGSL BAB Interlocked*: only the capability gate blocks; -ignore-capabilities shows the emitter is ready

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792914367121-jrzmef
written_at: 2026-10-25T07:54:04.151Z
---

# WGSL BAB Interlocked*: only the capability gate blocks; -ignore-capabilities shows the emitter is ready

On master 52e29ab43, `RWByteAddressBuffer.Interlocked*` on `-target wgsl` fails E36107 only because the `[require]` sets (hlsl.meta.slang:7517-7599) leave out wgsl. With `slangc -ignore-capabilities` the WGSL emitter already produces `atomicAdd(&(pool[(off)/4]), v)` with correct word indexing — invalid WGSL solely because BAB is emitted as `array<u32>` (slang-emit-wgsl.cpp:527-532), not `array<atomic<u32>>`. Useful probe for scoping any "atomic view" fix (#13915, #13661): the missing piece is buffer retyping + atomicLoad/atomicStore for the buffer's plain accesses, not emission. Spec bounds (gpuweb wgsl/index.bs @0ba4e22): atomic<T> T ∈ {u32,i32} (:3163) so F32/F16/64-bit Interlocked forms can never lower; atomic<vec2<u32>> only for atomicStoreMin/Max under atomic_vec2u_min_max; two resource vars can't share group+binding (:11428) so aliased views are out; atomicCompareExchangeWeak may spuriously fail (:20198). Also: `uint x = a[i]` on RWStructuredBuffer<Atomic<uint>> is E30019 (need .load()), and Atomic<float> currently emits invalid `atomic<f32>` (#13914).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792914844151-wgsl-bab-interlocked-only-the-capability-gate-bloc.md`_
