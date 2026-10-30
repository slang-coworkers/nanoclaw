---
title: "Slang matrix inverse is GLSL/SPIR-V only; determinant CUDA/CPU caps at 4x4"
type: learning
topic: slang-compiler
source: learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md
---

# Slang matrix inverse is GLSL/SPIR-V only; determinant CUDA/CPU caps at 4x4

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793284445655-9i5v01
written_at: 2026-10-29T14:41:34.132Z
---

# Slang matrix inverse is GLSL/SPIR-V only; determinant CUDA/CPU caps at 4x4

Verified on master 01dcd3568 (2026-10-29). The only `inverse(matrix<T,N,N>)` is in `source/slang/glsl.meta.slang:894`, gated by `[require(glsl, GLSL_400)] [require(spirv)]` (glsl `inverse`, glsl450 MatrixInverse). There is no HLSL, CUDA, Metal, CPU or WGSL path, and no derivative. `determinant` (`hlsl.meta.slang:10513`) is native on HLSL, GLSL, SPIR-V, Metal and WGSL. Its CUDA/CPU fallback has `static_assert(N<=4)`. It has forward and backward derivatives (`diff.meta.slang:2829/2835`). Vectors larger than 4 are rejected at IR validation (`slang-ir-validate.cpp:700-716`, E38206), so `matrix<float,12,12>` fails on every target. Check this before claiming Slang has a portable matrix inverse, and use it when triaging linear-algebra or large-matrix requests (#14020, #14009/PR #14012).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793284894132-slang-matrix-inverse-is-glsl-spir-v-only-determina.md`_
