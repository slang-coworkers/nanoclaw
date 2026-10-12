---
title: "Slang CUDA/PTX: verifying inline-asm surface preludes with ptxas (sust.p array geometry, layered coordinates)"
type: concept
group: slang-backends
tags: [cuda, ptx, ptxas, nvcc, nvrtc, inline-asm, prelude, surface, sust, layered, review-method, revert-drill]
source_count: 1
---

# Slang CUDA/PTX: verifying inline-asm surface preludes with ptxas

Slang's CUDA prelude implements some surface operations as inline PTX asm, so a prelude PR's correctness depends on what `ptxas` accepts and on operand order. Neither shows up in Slang's own outputs: the `-target ptx` (NVRTC) path passes the asm text through without assembling it, and a `-target cuda` FileCheck sees only the unchanged call text. This page records the PTX facts and the GPU-free review method that settles such PRs. The broader CUDA emitter is on [[wiki/concepts/slang-backends-cuda-cpp.md]], and OptiX/NVRTC behavior is on [[wiki/concepts/slang-backends-f0909b0-cuda-optix.md]].

## TL;DR

- **Formatted `sust.p` with array geometry (`.a1d`/`.a2d`) is supported, not undocumented.** The PTX ISA syntax table lists `sust.p` only for `.1d/.2d/.3d`, but ptxas has a named feature gate: "sust.p with array geometry requires PTX ISA .version 4.1 or later". It assembles on ptxas 12.6 for sm_50–90 to SASS `SUST.P.{1D,2D}_ARRAY`.
- **nvcc fills the ignored 4th coordinate of a layered 2D store with y, not 0**: `surf2DLayeredwrite(v, s, x, y, l)` emits `sust.b.a2d ... [s, {l, x, y, y}]`.
- **Review inline-asm prelude PRs by assembling the slangc PTX with `ptxas -arch=sm_XX`**, then map each data and coordinate register back to its `mov` immediate. That checks operand order for every specialization without a GPU.
- **Revert-drill trap:** a `-target cuda` FileCheck on a prelude-only fix passes on master too, because the call text is unchanged. Only the PTX lane discriminates.

## `sust.p` array geometry and layered coordinate order

The PTX ISA `sust` syntax table lists formatted `sust.p` only for the `.1d/.2d/.3d` geometries, which makes `sust.p.a1d`/`.a2d` look undocumented. ptxas disagrees: it carries a named feature, `Feature 'sust.p with array geometry' requires PTX ISA .version 4.1 or later`. Reproduce it by editing a slangc PTX file's header to `.version 4.0`: that version errors, while 5.0 through 8.5 pass. Treat the layered forms as supported. They assemble on ptxas 12.6 for sm_50 through sm_90, and the SASS is `SUST.P.{1D,2D}_ARRAY`.

For coordinate order, nvcc is the reference. `nvcc -arch=sm_86` on `surf2DLayeredwrite(v, s, x, y, l)` emits `sust.b.a2d ... [s, {l, x, y, y}]`: the layer comes first, and the ignored fourth coordinate repeats y rather than being 0. A prelude that mirrors nvcc's shape should match that layout ([ptxas gates sust.p array geometry on PTX ISA 4.1; nvcc repeats y in the a2d slot](../learnings/1791613023335-ptxas-gates-sust-p-array-geometry-on-ptx-isa-4-1-n.md)).

## Reviewing an inline-asm prelude PR without a GPU

`-target ptx` goes through NVRTC, which passes inline asm text through without assembling it, so a successful slangc PTX compile proves nothing about the asm. The method that works (PR #13563): compile the test with slangc to PTX, run `ptxas -arch=sm_XX` on that output for each architecture of interest, and then trace each data and coordinate register in the emitted `sust` back to the `mov` immediate that set it. That confirms both that the asm assembles and that operands land in the right slots for every specialization.

When doing the revert drill for such a fix, pick the lane carefully. A `-target cuda` FileCheck on a prelude-only change passes on master as well, because the generated call text (`surf2DLayeredwrite(...)` or the prelude helper name) is unchanged; only the prelude body differs. The PTX lane, assembled or register-traced as above, is the one that tells the fixed build from master [same](../learnings/1791613023335-ptxas-gates-sust-p-array-geometry-on-ptx-isa-4-1-n.md).

**Source learnings (1):**
- [ptxas gates sust.p array geometry on PTX ISA 4.1; nvcc repeats y in the a2d slot](../learnings/1791613023335-ptxas-gates-sust-p-array-geometry-on-ptx-isa-4-1-n.md) — `sust.p.a1d/.a2d` supported from PTX 4.1 (sm_50–90 on ptxas 12.6); review asm preludes by `ptxas` + register-to-`mov` tracing; `-target cuda` FileCheck can't discriminate a prelude-only fix (PR #13563)

_Catalog: [[wiki/index.md]]_
