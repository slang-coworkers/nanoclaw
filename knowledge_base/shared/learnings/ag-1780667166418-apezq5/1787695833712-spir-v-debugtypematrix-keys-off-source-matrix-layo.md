---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787694870716-oh57bd
written_at: 2026-08-25T22:10:33.712Z
---

# SPIR-V DebugTypeMatrix keys off source matrix-layout modifier (only col-major buffer members wrong)

Issue shader-slang/slang#12757: NonSemantic `DebugTypeMatrix` metadata for a `column_major` matrix that is a **constant-buffer member** is wrong — Slang emits `(vec2, 3, columnMajor=false)` where DXC/glslang emit the physically-correct `(vec3, 2, true)`. Row-major buffer members and ALL local matrices are already correct.

Root cause (source-verified, HEAD v2026.16): single emit site `source/slang/slang-emit-spirv.cpp:11108-11138` computes the 3 `emitOpDebugTypeMatrix` operands off `matrixType->getLayout()` (the *source* row/col-major modifier). The col-major branch swaps `getRowCount()`/`getColumnCount()` into the vector and sets `columnMajor=false`. `normalizeMatrixDebugType` (`:10899`, called `:11260`) forces Slang-row-major ONLY for non-buffer types (early-returns unchanged for `isTypeInBuffer==true`), which is exactly why only col-major *buffer* members reach the buggy branch.

Key principle: a SPIR-V `OpTypeMatrix` is identical for all layouts (`%mat2v3float = OpTypeMatrix %v3float 2`); it is inherently an array of column vectors. Buffer PACKING layout is carried separately by the `RowMajor`/`ColMajor` member decoration + `MatrixStride` (emitted at `slang-emit-spirv.cpp:7054-7078`, where Slang's terminology is deliberately REVERSED vs SPIR-V). So the debug type of the *value* should be layout-independent = `(vec(getColumnCount()), getRowCount(), columnMajor=true)`.

Triage traps worth reusing:
1. NOT a regression despite looking like one — current behavior was introduced deliberately by PR #9708 ("Fix emission of SPIR-V DebugTypeMatrix matrix layout operand", merged 2026-01-26, Fixes #9325). Always `git log -L` the emit branch + `git log` the test file before labeling `regression`.
2. The reporter (pdeayton-nv) was the AUTHOR of #9708 — so the fix reverses part of their own prior PR; likely aligned, but flag for author/maintainer sign-off.
3. The existing test `tests/spirv/debug-matrix-layout.slang` (lines 54/63) LOCKS IN the disputed col-major-buffer output. A "fix" that ignores this test would silently be blocked by it — any real fix must update it, and re-verify `debug-matrix-layout-non-buffer.slang` (`CHECK-NOT ... %false`).
4. Fully reproducible at COMPILE TIME with `slangc ... -target spirv-asm -g2` (no GPU) — grep the asm for `DebugTypeMatrix`.
