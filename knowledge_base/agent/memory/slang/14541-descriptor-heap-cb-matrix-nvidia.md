---
type: chain
title: "slang#14541 — SPIR-V descriptor-heap ConstantBuffer matrix load: spec-correct codegen, NVIDIA driver fault"
description: h7per P0-cand (draft 08 of the 2026-11-17 batch). jhelferty-nv asked the bot to inspect the SPIR-V; triager verdict = emitted module spec-conformant (SPV_EXT_descriptor_heap rev 2 + SPV_KHR_untyped_pointers rev 4), failure is NVIDIA driver 595.91.07 dropping layout on the untyped path. Fixer handoff parked on operator decision.
tags: [slang, spirv, descriptor-heap, nvidia-driver, parked-operator]
---

# slang#14541 — heap-CB matrix load, NVIDIA

**Status:** Triage complete (2026-11-18); analysis posted on the issue; **parked on operator decision** (fixer handoff / driver-bug filing).

**Chain:** slang-triager, canonical thread `gh-issue-shader-slang/slang-14541`, dispatched 11-18 18:24Z
after jhelferty-nv's @nv-slang-bot mention (comment 6987631483: "inspect the SPIRV code to ensure it's
performing the correct computations"); jkwak-work context: local spirv-val passes.

**Triager verdict (master 4a1d62c5b, codex-critique upheld):**
`OpBufferPointerEXT %_ptr_Uniform` (untyped) → `OpUntypedAccessChainKHR` (Block struct, Offset 0,
RowMajor + MatrixStride 16) → `OpLoad %mat4v4float` is the spec-sanctioned form — the load must inherit
member decorations (rev-4 §2.16.2 provenance + as-if clause), so the module encodes the intended
row-major load. **Spec-correct codegen; NVIDIA-driver fault** (595.91.07 drops layout on the untyped
path → transposed reads; VK_ERROR_DEVICE_LOST on a validating module is a driver fault; Mesa Xe2
correct; same driver correct via typed paths). spirv-val passing is not in tension (certifies producer,
not execution semantics — covered in the CC to jkwak-work).

**Files:** `slang-ir-spirv-legalize.cpp:1303` (`processConstantBufferDescriptorHeapLoad`) ·
`slang-emit-spirv.cpp:7821` (`emitDescriptorHeapLoad`) · `slang-emit-spirv.cpp:7034` (`emitLayoutDecorations`).

**Parked decision (operator):** (A) file NVIDIA driver bug (evidence package ready, triager-side);
(B) optional Khronos SPIR-V clarification; (C) Slang defensive emission — A′ row-vector loads (needs
L40S GPU-verify first) or B′ typed leaf pointer (v2026.11 shape; re-opens #11483/#12226 design space).
Per filing policy: external filing + new fixer chain both need the operator.

**Artifacts:** issue comment 6988124513 (2026-11-18T18:43Z, verified live). Fix brief:
[raw/triage-14541.md](raw/triage-14541.md) (triager memo, 11-18). Triager state:
`memory/issues/14541.md` (triager group). Re-check task: `recheck-14541-operator-decision` (one-shot, fires 2026-11-21T19:00Z).
