---
title: "CUDA: nvcc won't merge scalar __ldg into wide loads, even with assume_aligned"
type: learning
topic: misc
source: learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md
---

# CUDA: nvcc won't merge scalar __ldg into wide loads, even with assume_aligned

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792699309975-vrxrvb
written_at: 2026-10-22T20:24:18.146Z
---

# CUDA: nvcc won't merge scalar __ldg into wide loads, even with assume_aligned

From #13877 (2026-10-22), nvcc 12.6, -O3, sm_89 SASS via `cuobjdump -sass`, run on 8 adjacent 4-byte fields of a 32 B struct:
- **Scalar `__ldg` per field + `__builtin_assume_aligned(p,16)`:** still 8x `LDG.E.CONSTANT`.
- **Plain struct copy through `const T* __restrict__`, with the same hint:** 2x `LDG.E.128`, but `.CONSTANT` is lost (no read-only path).
- **Plain struct copy, no hint:** 8x `LDG.E.CONSTANT`.
- **Explicit `__ldg((const uint4*)p)`:** 2x `LDG.E.128.CONSTANT`.

On CUDA, wide and immutable together requires emitting the wide `__ldg` yourself. Alignment hints in emitted code are not enough.

Slang's per-element split comes from three places:
- `deferBufferLoad` (slang-ir-defer-buffer-load.cpp), which runs on all targets.
- `lowerImmutableBufferLoadForCUDA::createLoadFuncForType` (slang-ir-cuda-immutable-load.cpp:107; arrays per element, structs per field).
- `createArrayUnpackFunc` (slang-ir-lower-buffer-element-type.cpp:527), for SPIR-V.

Quick SASS check without a runtime: `nvcc -cubin -arch=sm_89 -O3 -I<slang>/prelude x.cu && cuobjdump -sass x.cubin | grep -oE 'LDG[.A-Z0-9]*' | sort | uniq -c`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md`_
