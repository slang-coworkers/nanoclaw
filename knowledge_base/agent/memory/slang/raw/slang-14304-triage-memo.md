---
type: triage
title: "Triage: shader-slang/slang#14304 — Bugs in matrix indexing"
description: m[i][j]/._mij on a cbuffer float4x4 reportedly reads row 0 on SPIR-V -O0. Slang SPIR-V is correct; not reproduced on L40S (full shader, both layouts). Leading hypothesis is a driver bug with chained OpAccessChain through a RowMajor-decorated matrix column. Parked for reporter GPU/driver info.
tags: [spirv, matrix-layout, access-chain, driver, needs-info]
resource: /workspace/agent/scratch-14304/
---
# Triage: shader-slang/slang#14304 — Bugs in matrix indexing
Date: 2026-11-04 | bug (unconfirmed, possibly driver) | medium | P2 | target-emit (SPIR-V) | Duplicate: no

## What's broken / being requested
Reporter JackOfBlades232 (external, assoc NONE). Says `viewParams.mProj[0][0]` / `[1][1]` (and `._mMN`) in
`ssao_generate` "always use row0", and `[0].x` / `[1].y` works. Uses Vulkan SDK 1.4.357.0 (bundles Slang 2026.13.1), Windows 11,
GPU unknown. Command: `slangc -target spirv example.slang -entry postfx_vertex_main -entry ssao_generate -O0`. No layout flag
(default = column-major → SPIR-V `RowMajor` + `MatrixStride 16`). They could not reduce the repro.

## Repro (facts)
- Minimal: `/workspace/agent/scratch-14304/min.slang` (5×float4x4 cbuffer; `fs_idx` uses [i][j]/._mij, `fs_swz` uses [i].x).
- `[i][j]` and `._mij` emit a CHAINED access chain: `OpAccessChain mat %cb %int_4` → `OpAccessChain v4 %mat %int_1` →
  `OpAccessChain float %col %int_1` → `OpLoad float`. `[i].y` emits the column access chain → `OpLoad v4` → `OpCompositeExtract 1`.
  The indices are correct. spirv-val passes (minimal and full shader). The pattern is the same in 2026.13.1, a 2026.13.1-50 build, and the v2026.21 release
  (HEAD v2026.21-5 adds no access-chain change). At -O0 and -O1 the chain stays split. At -O2 spirv-opt `CombineAccessChains` folds it
  to one `OpAccessChain %cb %int_4 %int_1 %int_1`. `-emit-spirv-via-glsl` (glslang) also emits one combined chain.
- Runtime on L40S (driver 595.91.07), Vulkan:
  - slang-test compute: [i][j] == [i].x == ._mij with the correct values, under both `-matrix-layout-column-major` and `-row-major`, at -O0.
  - Reporter's FULL shader: run with the headless harness `scratch-14304/harness.cpp` (vertex+fragment, exact two-entry-point -O0 SPIR-V,
    full cbuffer layout from reflection). Original vs `[0].x/[1].y` workaround: **0/4096 pixels differ** (bit-identical), for both layout
    flags, on both 2026.13.1-50 and v2026.21. Sensitivity control `v_sim` (replaces [1][1] with [2][0], which is what a stride-dropping
    driver would read) differs on 4096/4096 pixels. Probe variant `v_probe` reads (1.5, 2.5, 1.0, -0.1) via both [i][j] and swizzle.
  - lavapipe present but slang-test reports vk "Not Supported" on it; not run.
- Conclusion: NOT reproduced. Do not apply `reproduced`.

## Hypothesis (unconfirmed)
A driver mishandles an OpAccessChain whose base is a pointer to a column of a `RowMajor`-decorated matrix: it drops the
MatrixStride on the second chain. Then `[i][j]` reads byte offset 4i+4j instead of 4i+16j, which always lands in the first 16
bytes. That is "row 0" in host row-major terms, which matches the report. With `-matrix-layout-row-major` (SPIR-V `ColMajor`) the column is
contiguous, so the same driver bug would not show. `[i].x` loads the whole column, a common glslang/DXC pattern that drivers handle.

## Codebase digest (file:line @ HEAD 3da6f63c0)
- `slang-emit-spirv.cpp:8803` emitFieldAddress, `:8888` emitGetElementPtr → one OpAccessChain per IR address inst (`:8928`); no folding.
- `slang-emit-spirv.cpp:11085` translateIRAccessChain + `slang-ir-util.cpp:1259` getRootAddr: an existing chain walk (DebugValue only).
- `slang-lower-to-ir.cpp:7046` subscriptValue → tryGetAddress(Aggressive) `:7056` → emitElementAddress `:7131` (GEP chain for [i][j]);
  visitMatrixSwizzleExpr `:7477` (._mij → same GEP chain); visitSwizzleExpr `:7515` (load + swizzle for [i].y).
- `slang-glslang.cpp:500` CreateCombineAccessChainsPass is registered only for HIGH/MAXIMAL (`:464`); DEFAULT is `:338`.
- Store path (RWStructuredBuffer matrix element) uses the same chained shape, so any fix must be address-based, not load+extract.
- Test nearby: `tests/spirv/optypematrix-layout-modifier.slang` (runtime vk, no OpAccessChain shape CHECK).

## Candidate approaches
### A: Fold nested address chains into one OpAccessChain in the SPIR-V emitter
- Where: emitGetElementPtr/emitFieldAddress (`slang-emit-spirv.cpp:8803/8888`), walking the base like getRootAddr.
- Delta: emits `OpAccessChain %root i0 i1 i2`, matching glslang, DXC and spirv-opt -O2. Covers loads, stores and all address spaces.
- Tradeoffs: broad output change, so many FileCheck tests churn. Must keep NonUniform (#10656), narrow-index widening (#13196), untyped
  `OpUntypedAccessChainKHR` (descriptor heap) and debug info. Dead intermediate chains are left behind.
- Risk: medium (wide blast radius in emitted SPIR-V).
### B: Targeted fold only through a matrix column inside a layout-decorated aggregate
- Where: same emitter functions, gated on base type = matrix / vector-in-matrix in Uniform/StorageBuffer/PushConstant/PSB.
- Delta: only the risky pattern changes. Tradeoffs: special-cases one shape (the CLAUDE.md "hardcoded trivia" smell), but it has a
  clear invariant. Risk: low.
### C: Add CombineAccessChains to the -O1 spirv-opt list (`slang-glslang.cpp:338-455`)
- Does not help -O0, which is the reporter's case. Rejected as the fix for this issue.
### D: No compiler change (the driver is at fault)
- Report to the GPU vendor. Workarounds: `[i].x`, `-O2`, or `-emit-spirv-via-glsl`. Valid if the vendor confirms; the Slang SPIR-V is legal.

## Recommended path
Park. The defect is not reproduced and the Slang output is valid, so a fix would be guesswork (Decision table: cannot reproduce → no
guessed fix). Next: the reporter gives GPU vendor/model/driver and runs the discriminating tests. Those are (1) the probe lines in
ssao_generate and (2) recompiling with `-O2` and with `-O0 -emit-spirv-via-glsl`. If the bug goes away exactly when the chain is
combined, it confirms the driver-stride hypothesis. Then the maintainers decide between D (vendor report) and B (driver-compat
mitigation; A if they prefer conventional output). Handoff brief if direction = B:
- Hypothesis: driver drops MatrixStride on a chained OpAccessChain through a RowMajor matrix column.
- Files: `slang-emit-spirv.cpp:8888`, `:8803`, reuse `getRootAddr` (`slang-ir-util.cpp:1259`).
- Repro: `slangc -target spirv-asm scratch-14304/min.slang -entry fs_idx -O0` → expect ONE `OpAccessChain %viewParams %int_4 %int_1 %int_1`.
- Accept: FileCheck on combined chain for [i][j] and ._mij (load+store, cbuffer+SSBO, both layouts); vk runtime values unchanged; full suite green.

## Sources
- DeepWiki: emitter emits one OpAccessChain per address inst, no folding; [i][j] → GEP chain, [i].y → load+extract.
- Vulkan SDK 1.4.357 ships Slang 2026.13.1 (sebbbi/NoGraphicsAPI#1 / PR #15).
- Related but not dup: #13446 (integer-matrix layout), #4360, #5822, #6031. Recall: no prior hits.
