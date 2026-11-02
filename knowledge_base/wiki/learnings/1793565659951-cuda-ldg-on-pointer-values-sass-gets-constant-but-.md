---
title: "CUDA __ldg on pointer values: SASS gets .CONSTANT but no speedup on L40S; matrix buffer loads miss __ldg (pass order)"
type: learning
topic: misc
source: learnings/1793565659951-cuda-ldg-on-pointer-values-sass-gets-constant-but-.md
---

# CUDA __ldg on pointer values: SASS gets .CONSTANT but no speedup on L40S; matrix buffer loads miss __ldg (pass order)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793564877006-arrigt
written_at: 2026-11-01T20:40:59.951Z
---

# CUDA __ldg on pointer values: SASS gets .CONSTANT but no speedup on L40S; matrix buffer loads miss __ldg (pass order)

From triage of shader-slang/slang#14144 (2026-11-01, master 6815ed82d).

1. `createLoadFuncForType` (slang-ir-cuda-immutable-load.cpp:107-297) has no `kIROp_PtrType` case. Pointer values read through ImmutablePtr / StructuredBuffer stay plain loads. Because the struct and array cases are all-or-nothing (:285-289), one pointer field also cancels `__ldg` for every other field when the whole struct is loaded.

2. Hand-patching `slang_bit_cast<float*>(__ldg((const unsigned long long*)&p))` turns `LDG.E.64` into `LDG.E.64.CONSTANT` on sm_89. In a pointer-chase microbenchmark on the L40S it was NOT faster:
- Load-only loop: 107.7 ms vs 107.7 ms.
- Loop with a per-thread store: as-is 65–71 ms, `.nc` 108 ms.
- Control with the same bit-cast and a plain load: 70 ms.
- nvcc `const T* __restrict__` reference: 107 ms.
So `.nc`/`__restrict__` parity is not a speedup by default. Measure before you sell an `__ldg` coverage fix as a performance fix.

3. Side gap: top-level `ImmutablePtr<float3x3>` and `StructuredBuffer<float3x3>` loads get NO `__ldg`. `lowerBufferElementTypeToStorageType` puts the load inside a `[ForceInline] unpackStorage(RefParam)` helper, and `lowerImmutableBufferLoadForCUDA` (slang-emit.cpp:2721) runs before `performForceInlining` (:2724). The pass therefore sees `load(RefParam)`, which is not immutable. A matrix nested in a struct is unaffected.

Recipe: `-dump-ir-before lowerImmutableBufferLoadForCUDA`, then `nvcc -cubin -arch=sm_89` and `cuobjdump -sass | grep LDG`, then `cuobjdump -res-usage`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793565659951-cuda-ldg-on-pointer-values-sass-gets-constant-but-.md`_
