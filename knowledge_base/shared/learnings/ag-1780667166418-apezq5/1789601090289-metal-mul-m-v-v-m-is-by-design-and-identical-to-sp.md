---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789600245245-s49gzi
written_at: 2026-09-16T23:24:50.289Z
---

# Metal mul(M,v)→v*M is by-design and identical to SPIR-V — not the cause of Metal-only transposes

When triaging a "Metal matrix multiplication order is wrong / geometry transposed on Metal but correct on SPIR-V" report (e.g. shader-slang/slang#13141, and its 2024 predecessor #4253):

**The `mul(M, v)` → `v * M` operand reversal users notice in generated MSL is INTENTIONAL and is NOT Metal-specific.** `mul(matrix<T,N,M>, vector<T,M>)` is a core-module intrinsic (`hlsl.meta.slang:13871-13897`) with a per-target `__target_switch`: Metal `"($1 * $0)"` (:13879), GLSL/WGSL same swap, HLSL `mul` (no swap), and **SPIR-V emits `OpVectorTimesMatrix result $right $left` (:13881-83) — the SAME v·M operand order.** Because the matrix Slang emits for Metal/GLSL/SPIR-V is effectively the transpose of the logical matrix, `v * M_emitted` == the intended `M · v`. csyonghe on #4253: "Metal/GLSL 'column' = HLSL 'row'." This fix (PR #4143 / commit 1dcd814f50) is still intact. ⇒ operand order can NEVER be the differentiator between a correct-SPIR-V and wrong-Metal result — reject any "reverse the Metal mul operand order" fix; it would break the by-design correctness.

**There is also NO per-target default matrix-layout divergence.** All targets read one target-agnostic `getMatrixLayoutMode()` (slang-type-layout.cpp:3058,4296). The genuine footgun: the **C API default is ROW_MAJOR** (`SessionDesc.defaultMatrixLayoutMode`, slang.h:4452) but the **`slangc` CLI legacy default is COLUMN_MAJOR** (slang-end-to-end-request.cpp:1311-1313), uniformly for all targets. So a Metal-vs-Vulkan transpose almost always comes from (a) the two builds compiling with different layout modes, or (b) host uploading matrix bytes prepared for one major-ness — i.e. matrix STORAGE / host-upload interpretation, handled in IR lowering (`lowerMatrixAddresses` GetElementPtr index-swap + slang-ir-lower-buffer-element-type.cpp col-major arms), NOT the multiply.

**Metal emit is GPU-free inspectable** (`slangc -target metal`), so you can confirm the codegen shape, but the actual RENDERING defect needs a Metal GPU + the host upload code — do NOT apply `reproduced` from the codegen shape alone. For an external reporter with no minimal repro, the right move is to correct the operand-order misconception and ask for a minimal .slang + per-backend invocation/layout-mode + host-upload details before dispatching a fixer.

Related resolved issues: #4253 (mul order), #4537 (Metal ignored layout options, fixed 2024-07-19), #6031 (col-major access, host-side transpose).
