---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171558661-q4gptw
written_at: 2026-08-19T20:59:08.906Z
---

# CUDA/PTX 1D texture Load: integer-coord tex.level.1d silently returns zero (GPU-verified) — diagnose, don't un-gate

slang#12630. The `#if 0` block in `prelude/slang-cuda-prelude.h` (before the fix) held a "1D
`tex.level.1d.v4...s32`" impl that looked ready to un-gate to implement `Texture1D.Load` on CUDA/PTX.
DO NOT un-gate it. GPU-verified on an L40S (CUDA 12.6): the exact integer-coordinate 1D texel fetch
`tex.level.1d.v4.f32.s32` against a correctly-set-up 1D CUDA array **silently returns all zeros**
(no launch error), while three controls on the SAME array — `tex1D<>`/`tex1DLod<>` builtins and
`tex.level.1d.v4.f32.**f32**` (float coord) — all return CORRECT data, and the identical 2D
`tex.level.2d...s32` form (positive control) is CORRECT. So it is the integer-coordinate 1D
instruction specifically that is unsupported, matching the in-tree "1D is not supported via PTX"
comment.

Why: CUDA's only integer-coord 1D fetch is the runtime `tex1Dfetch()`, which needs a
**linear-memory-backed** texture; but Slang (and slang-rhi via `cuArrayCreate` +
`CU_TRSF_NORMALIZED_COORDINATES`) binds `CUtexObject`s as CUDA **arrays**, which have no integer 1D
fetch. A genuine 1D Load impl would have to abandon the `.s32` instruction and thread the texture
width through to a float-coordinate fetch `(x+0.5)/width` — a real design change with its own GPU
integration test, NOT a fix-issue un-gate.

Method note: the decisive A-vs-B experiment is a ~30-line standalone `.cu` (nvcc -arch=sm_89) that
runs the exact prelude asm with 2D + builtin-1D + float-coord-1D as positive controls — cheap, and
strictly better than a 20-min slang rebuild for answering "does this PTX instruction work at
runtime?". A ZERO result is only meaningful with a positive control through the same instrument;
here three controls proved the array setup was fine, isolating the failure to the instruction.

Fix shipped = diagnose (per-case `static_assert(false)` in the 1D arm of the `cuda` case of
`_Texture<T>.Load` in hlsl.meta.slang, mirroring the existing catch-all), remove the now-dead stub,
fix backwards `docs/cuda-target.md:133`. Third variant of the empty-prelude family (#12274 case-less
silent-empty; #12277 declared-but-uninstantiated loud link error; #12630 case-present-empty-stub
silent-empty).
