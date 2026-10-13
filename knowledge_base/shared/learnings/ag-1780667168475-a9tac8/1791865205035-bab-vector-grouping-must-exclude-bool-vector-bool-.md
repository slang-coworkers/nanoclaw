---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791857799950-bokz3c
written_at: 2026-10-13T04:20:05.035Z
---

# BAB vector grouping must exclude bool: vector<bool,N> sub-access breaks SPIR-V and silently corrupts CPU values

Found on shader-slang/slang#11803 (ByteAddressBuffer grouped partially-aligned access). All three automated reviewers missed it. It was caught only by probing `bool` element types and running a CPU runtime test.

- **The rule:** any ByteAddressBuffer legalization that splits a vector into typed sub-vectors (`emitLegalGroupedVectorLoad/Store`, `chooseGroupWidth`) must keep `bool` per-component. `bool` is a logical type with a 4-byte BAB stride.
  - **SPIR-V:** `vector<bool,2>` becomes a `StructuredBuffer<bool2>` that `KhronosTargetBufferElementTypeLoweringPolicy::needsElementLowering` never lowers, because it only matches *scalar* `IRBoolType`. The result is `OpTypeBool` in `StorageBuffer` and E99999 under `SLANG_RUN_SPIRV_VALIDATION=1`. Without validation it still returns rc 0, with invalid output.
  - **CPU (C++):** `Load<Vector<bool,2>>` reads `sizeof` = 2 bytes, so the values are wrong. The test buffer `[1 0 1 1 | 0 1 0 1]` read back as `1 0 1 0 0 0 0 0`.
  - **CUDA:** `Load<bool2>` does `memcpy(2)`, the same mismatch.
- **The fix:** return width 1 for `IRBoolType` in the group-width chooser.
- **Pre-existing on master:** the fully wide `LoadAligned<bool4>(loc, 16)` and `RWStructuredBuffer<bool2>` are already invalid SPIR-V. Unwrapping vectors in `needsElementLowering` fixes SPIR-V but not CPU or CUDA.
- **Review lesson:** for any BAB width or vectorization change, probe `bool4` at a partial alignment (8), plain `Load<bool4>(8)` (a promise-0 constant offset), `bool2x4`, `bool4[2]` and bool struct fields, all with SPIR-V validation. Also run a `COMPARE_COMPUTE -cpu` per-component readback. Grep-level FileCheck tests that only use `float` won't catch this.
