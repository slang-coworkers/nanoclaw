---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787758843776-b0mp3k
written_at: 2026-09-01T23:27:14.160Z
---

# [approver/human-agreement] CONFIRMED safe: SPIR-V pointer-ArrayStride element-vs-object-size fix (slang#12698) — merged unchanged at the exact decided commit

Calibration join: slang#12698 (WOULD_APPROVE / CLEAN @ `40727328be86`) MERGED by jkwak-work on 2026-09-01, merged head == my decision commit exactly (4 commits on PR, last = 40727328be86, mergeCommit 1c2e5d2a9762). Zero follow-up commits between my decision and merge ⇒ humans shipped precisely what I gated. merged ⇒ APPROVED-equivalent ⇒ AGREEMENT.

The class of change this confirms as safe (sharpens Step-0 recall for similar PRs): a SPIR-V emit change that **widens which pointee types take the element-stride branch** in the pointer-type ArrayStride computation (here `getPointerArrayStrideValue` `as<IRUnsizedArrayType>`→`as<IRArrayTypeBase>`, so a Storage/PhysicalStorageBuffer pointer to a SIZED array carries the array *element* stride, matching the pointee array's own ArrayStride, instead of the whole-array object size).

Why it was safe, and the transferable probes that held up:
1. **Layer check via the access-chain graph.** The decoration being retargeted is only consumed where you can *see* it consumed. Confirmed from emitted SPIR-V that whole-object stepping (`p[i]`/`p+1`) uses a DIFFERENT pointer (the `_Array_...` struct-wrapper, `OpPtrAccessChain`, stride unchanged), while the retargeted raw `_arr_...` pointer only ever feeds an element-indexing `OpAccessChain`. When a codegen fix changes a decoration, trace which SPIR-V op reads it before judging blast radius — the wrapper-vs-raw pointer split is the invariant.
2. **Trigger-present deterministic control beats a driver-tolerant GPU test.** The bot flagged the GPU runtime test as driver-dependent (Mesa ignores the pointer decoration). The change was still safe to clear because a `//TEST:SIMPLE(filecheck)` emission test asserted the exact new stride literals and fails on revert. For layout-decoration PRs, that deterministic control is the load-bearing guard.
3. **Value legality.** New strides (float2 std140/std430 = 16/8) are standard-layout-legal; no vec3-style stride<align mismatch ⇒ no new/relaxed VK_EXT_scalar_block_layout requirement.

Bottom line: "widen an existing element-stride branch to cover more array pointee types, guarded by a deterministic emission FileCheck, at a layer proven correct by the access-chain graph" is a SHIP-AS-IS shape. External-contributor + fork + spec-cited motivation + author-added both a runtime and an emission test correlated with a clean merge.
