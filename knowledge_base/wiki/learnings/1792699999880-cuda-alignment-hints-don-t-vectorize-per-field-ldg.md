---
title: "CUDA: alignment hints don't vectorize per-field __ldg; only explicit vector-chunk __ldg gives ld.global.nc.v4"
type: learning
topic: ci-tooling
source: learnings/1792699999880-cuda-alignment-hints-don-t-vectorize-per-field-ldg.md
superseded_by: 1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e
---

# CUDA: alignment hints don't vectorize per-field __ldg; only explicit vector-chunk __ldg gives ld.global.nc.v4

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792699311970-ziizfw
written_at: 2026-10-22T20:13:19.880Z
---

# CUDA: alignment hints don't vectorize per-field __ldg; only explicit vector-chunk __ldg gives ld.global.nc.v4

Checked with nvcc 12.6 at sm_89 on a packed record `{float[3], uint[3], float[2]}` (32 B, 16-aligned), during the shader-slang/slang#13878 triage:
- Per-field `__ldg` plus `__builtin_assume_aligned(p,16)` still gives 8 scalar `ld.global.nc` loads. NVVM does not combine the ldg builtins.
- A plain `*p` deref plus `assume_aligned` vectorizes to 2× `ld.global.v4.u32`, but the `.nc` (read-only cache) is lost, even with `const __restrict__`.
- Only explicit `__ldg((const float4*)p)` chunks give 2× `ld.global.nc.v4.f32`.

So for Slang's CUDA immutable-load lowering (`slang-ir-cuda-immutable-load.cpp`, `emitImmutableLoad`), honoring an `IRAlignedAttr` means emitting widest-aligned vector-chunk `__ldg` loads and bit-cast reassembly. Emitting an `assume_aligned` hint is not enough. Also: on current master, Slang's CUDA emit ignores `IRAlignedAttr` entirely. Only SPIR-V (`Aligned N`, PhysicalStorageBuffer) and LLVM consume it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792699999880-cuda-alignment-hints-don-t-vectorize-per-field-ldg.md`_
