---
type: triage
title: "Triage: shader-slang/slang#14541 — heap ConstantBuffer matrix, SPIR-V semantics analysis"
---

# Triage: shader-slang/slang#14541 — heap `ConstantBuffer` matrix reads transposed / loses device
Date: 2026-11-18 | Category: bug (regression) | Severity: high | Priority: P0-candidate | Component: target-emit SPIR-V (descriptor heap) | Duplicate: no

## What's broken / requested
`float4x4` member of a heap `ConstantBuffer` (`DescriptorHandle<ConstantBuffer<T>>`, `-capability spvDescriptorHeapEXT`): on NVIDIA L40S driver 595.91.07 the matrix loads transposed and can trigger `VK_ERROR_DEVICE_LOST`; Mesa (Xe2) is correct. `spirv-val` passes. Maintainer direction (jhelferty-nv, 2026-11-18): inspect the emitted SPIR-V and verify the computation. Regression lineage: #11483 → #11647 (StorageBuffer flip) → #12226/#12256 (untyped Uniform data pointer). v2026.11 (typed Uniform data pointer) was correct on the same driver.

## Repro
Verbatim issue repro: `/workspace/agent/scratch/gh14541/issue-repro.slang`. Compile: `slangc -target spirv -capability spvDescriptorHeapEXT issue-repro.slang -o out.spv` (release slangc needs `LD_LIBRARY_PATH=build/Debug/lib` for asm output / validation). GPU host harness recipe: shared learning 1793176601479 (heaprun.cpp no longer on disk — rebuild required).

## Semantics verdict (2026-11-18, master 4a1d62c5b)
The module is **spec-conformant and computes the intended row-major load** — the failure is driver-side:
- SPV_KHR_untyped_pointers rev 4 (2026-06-20, "Clarify matrix access rules") §2.16.2: untyped pointers accessed as a matrix/row must derive from an access chain whose **Base Type is a structure** — Slang's emission is exactly this shape (`OpUntypedAccessChainKHR` Base Type = Block struct → member 0 Offset 0 + RowMajor + MatrixStride 16 → `OpLoad %mat4v4float`).
- §2 "as-if" clause: load through untyped pointer behaves as the corresponding typed pointer; matrix layout in SPIR-V lives only on struct members, so the typed equivalent carries the member decorations. The rev-4 provenance rule would be vacuous under any other reading (structures are the only layout-carrying construct).
- Same 64 bytes under row/col-major at stride 16 ⇒ the transpose cannot be an addressing/stride fault — pure layout-interpretation divergence. Device-lost on a validating module is a driver fault regardless.
- Posted analysis: issuecomment-6988124513 (codex-critiqued, verdict upheld; Khronos clarification offer included).

## Codebase digest (file:line)
- Legalize: `processConstantBufferDescriptorHeapLoad` — `source/slang/slang-ir-spirv-legalize.cpp:1303-1335` (SPIRVBlockDecoration at :1318; retypes heap CB load to `SPIRVUntypedPtrType(Immutable, Uniform)` at :1322-1331; untyped propagation in `processFieldAddress` :1499-1530 and `processGetElementPtrImpl` :1214-1244).
- Emit: `emitDescriptorHeapLoad` — `slang-emit-spirv.cpp:7821-7859` (OpUntypedAccessChainKHR into heap :7830-7838; OpBufferPointerEXT :7841-7847); untyped ptr types :7512-7528; `emitFieldAddress` :8792-8845 (Base Type = struct :8827-8838); `emitGetElementPtr` :8877-8897.
- Decorations: `emitLayoutDecorations` — `slang-emit-spirv.cpp:7034-7233` (Offset :7163; RowMajor/ColMajor :7197-7216 — Slang col-major ⇒ SPIR-V RowMajor; MatrixStride :7225).
- #12256 = commit 6dba5d212 (2026-07-29); #11647 = 012051b20.
- Tests: `tests/spirv/descriptor-heap-constant-buffer-*.slang` are compile/filecheck only — no GPU test executes a heap-CB matrix read.

## Candidate approaches (for the eventual fixer handoff — operator decision pending)
### Approach A: Defensive row-vector emission for heap-CB matrix loads
- Where: legalize (`slang-ir-spirv-legalize.cpp:1303`) or emit — lower whole-matrix `OpLoad` into per-row `%v4float` loads + assemble.
- Delta: no matrix-typed OpLoad off an untyped pointer.
- Tradeoffs: more instructions; sidesteps the driver's broken path; but per-row loads are still "row of a matrix" untyped accesses (rev-4 rule covers them) — NOT yet GPU-verified on 595.91.07.
- Risk: medium (row-of-matrix untyped chains unverified on the failing driver).
### Approach B: Typed data pointer for heap CBs (v2026.11 shape)
- Where: `processConstantBufferDescriptorHeapLoad` :1322-1331 — typed Uniform data pointer instead of `SPIRVUntypedPtrType`.
- Delta: typed OpAccessChain path; the emitter already emits typed pointers off `OpBufferPointerEXT` for SSBOs (verified in asm: `OpBufferPointerEXT %_ptr_StorageBuffer_RWStructuredBuffer`), and v2026.11's typed Uniform data pointer read correctly on this driver.
- Tradeoffs: re-opens #11483/#12226 (typed Uniform pointers lack pointer ArrayStride for array members). Matrix leaf members need no array stride; arrays of matrices would.
- Risk: medium-high (re-opens settled #12226 design; see learning 1785256702253).
### Approach C: No Slang change; driver bug + documented workarounds
- Delta: file the NVIDIA driver bug (evidence package ready in scratch) + keep source-level workarounds (`float4 rows[4]`, `StructuredBuffer<T>` — both GPU-verified) visible.
- Risk: users on current NVIDIA drivers keep hitting it.

## Recommended path
Driver-bug filing is the primary action — the module is spec-correct. If Slang wants robustness on current drivers, A, GPU-verified first on the L40S (including the row-of-matrix chain case and a device-lost check); B only if A's shapes also fail. Handoff itself is parked for the operator per the 2026-11-18 dispatch.

## Sources
- SPV_EXT_descriptor_heap rev 2 (2026-10-21), SPV_KHR_untyped_pointers rev 4 (2026-06-20) — verbatim quotes in the session scratch and issue comment 6988124513.
- Shared wiki: `slang-backends-spirv-descriptor-handles-and-heap.md`; learnings 1784939925118 (independent storage classes), 1793176601479 (L40S harness + regression history), 1785256702253 (typed vs untyped).
- Codex critique thread 01a1eff5-59a5-77b2-b6a0-974741daacf4 (verdict upheld, framing corrections applied).
