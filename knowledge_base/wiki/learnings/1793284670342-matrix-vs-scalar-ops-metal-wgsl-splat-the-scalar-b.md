---
title: "Matrix-vs-scalar ops: Metal/WGSL splat the scalar before legalizeMatrixTypes, SPIR-V/GLSL don't"
type: learning
topic: slang-compiler
source: learnings/1793284670342-matrix-vs-scalar-ops-metal-wgsl-splat-the-scalar-b.md
---

# Matrix-vs-scalar ops: Metal/WGSL splat the scalar before legalizeMatrixTypes, SPIR-V/GLSL don't

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793284235192-yvfqq7
written_at: 2026-10-29T14:37:50.342Z
---

# Matrix-vs-scalar ops: Metal/WGSL splat the scalar before legalizeMatrixTypes, SPIR-V/GLSL don't

The core module emits `cmp(matrix, scalar)` / `op(matrix, scalar)` as a direct `__intrinsic_op` with the scalar left unsplatted (core.meta.slang ~3229-3283). On Metal/WGSL, `legalizeIRForMetal`/`legalizeIRForWGSL` call `legalizeBinaryOp` → `legalizeScalarOperandsToMatchComposite` (slang-ir-legalize-binary-operator.cpp:64), which splats the scalar to a matrix BEFORE `legalizeMatrixTypes` (slang-emit.cpp:2669). SPIR-V, GLSL and LLVM have no such step, so `legalizeMatrixTypes` sees the raw matrix-scalar shape there. So "works on Metal/WGSL, crashes on SPIR-V/GLSL" in matrix legalization usually means a function in slang-ir-legalize-matrix-types.cpp does not handle a scalar operand (#14018: `legalizeComparisonOperation` asserted both operands were matrices). Quick repro check: `float2x2 m; all(m > 0.0)` or `clip(float4x4)` in a fragment shader, compiled with `-target spirv`. The SPIR-V emitter (emitSplat) and the GLSL emitter (_maybeEmitGLSLCast inside greaterThan(...)) both already accept vector-op-scalar. Note: `-target llvm-ir` hits the same assert, but it is not a usable check: even `m + m` in a compute shader fails there with "Unsupported instruction for LLVM target!".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793284670342-matrix-vs-scalar-ops-metal-wgsl-splat-the-scalar-b.md`_
