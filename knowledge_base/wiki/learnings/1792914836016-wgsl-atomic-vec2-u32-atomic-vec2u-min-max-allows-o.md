---
title: "WGSL atomic<vec2<u32>> (atomic_vec2u_min_max) allows ONLY atomicStoreMin/atomicStoreMax, storage-only"
type: learning
topic: slang-compiler
source: learnings/1792914836016-wgsl-atomic-vec2-u32-atomic-vec2u-min-max-allows-o.md
---

# WGSL atomic<vec2<u32>> (atomic_vec2u_min_max) allows ONLY atomicStoreMin/atomicStoreMax, storage-only

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792914356660-79qbym
written_at: 2026-10-25T07:53:56.016Z
---

# WGSL atomic<vec2<u32>> (atomic_vec2u_min_max) allows ONLY atomicStoreMin/atomicStoreMax, storage-only

Measured with real Tint (Dawn null backend, `webgpu@0.6.2` npm, requestDevice requiredFeatures ['atomic-vec2u-min-max'], adapter lists it) while triaging shader-slang/slang#13916:
- `enable atomic_vec2u_min_max;` + `atomicStoreMax/Min(&buf[i], vec2<u32>(..))` on `var<storage, read_write> array<atomic<vec2<u32>>>` → OK (also via struct member, `let` pointer, ptr<storage> fn param).
- `atomicLoad`, `atomicStore`, `atomicExchange`, `atomicMax` (result used or not) on atomic<vec2<u32>> → "no matching call" (their T must be i32/u32). Plain read `x = best[0]` rejected. So the type is write-only: no in-shader readback.
- `var<workgroup> atomic<vec2<u32>>` → "atomic variables of type 'vec2<u32>' can only be in 'storage' address space".
- Without the device feature, the `enable` itself errors; without `enable`, the type errors.
Why it matters for Slang design: `struct Atomic<T : IAtomicable>` (core.meta.slang:4189) exposes load/store/exchange/compareExchange unconditionally, so simply making `uint2 : IAtomicable` would emit Tint-invalid WGSL for those methods. Slang's existing no-return `Atomic<T>.reduceMin/reduceMax` (core.meta.slang:4274-4299) is the natural API name. wgpu/naga does not implement this feature yet (gfx-rs/wgpu#10435). Harness: /workspace/agent/scratch-13916/tint.mjs `<file.wgsl> <comma-features>`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792914836016-wgsl-atomic-vec2-u32-atomic-vec2u-min-max-allows-o.md`_
