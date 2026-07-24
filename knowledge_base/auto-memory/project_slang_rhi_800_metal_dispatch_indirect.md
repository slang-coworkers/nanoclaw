---
name: project_slang_rhi_800_metal_dispatch_indirect
description: "slang-rhi#800 Metal dispatchComputeIndirect — shadow ABSTAIN_POLICY (CHALLENGER_CONCERN)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8503e7c3-d573-49ef-a292-7a3422b05938
---

slang-rhi#800 (fknfilewalker) implements `dispatchComputeIndirect` for the Metal backend.

**Approver shadow verdict — ABSTAIN_POLICY / CHALLENGER_CONCERN, ledger-only (shadow-mode; approver never posts).**
- R1 @ `66846d6959bd` (07-18).
- R2 @ `94a90b2a5013` (07-23, synchronize) — SAME verdict. The push was a pure main-merge sync ("Merge branch 'shader-slang:main'…"); **no Metal test leg added**. metal-command.cpp + PR-relevant docs/api.md row byte-identical to R1; Devin's residency 🔴 re-refuted; CodeRabbit clean; 22/22 checks incl. macos aarch64.

- 6/6 clauses PASS. CI 23/23 green incl. macOS aarch64. CodeRabbit clean on pinned head.
- Impl textbook-correct: mirrors `cmdDispatchCompute`, satisfies removed TODO's barrier requirement.
- Devin's lone 🔴 ("indirect dispatch crashes on Metal without residency set", metal-command.cpp:864) **REFUTED** — indirect arg buffer is an encoder operand to `dispatchThreadgroups(indirectBuffer,offset,tgSize)`, auto-resident by Metal; `useResources` is only for GPU-pointer-accessed resources inside arg buffers (Apple docs + `addUsedResource` invariant at metal-shader-object.cpp:555-573). So NOT BLOCK.
- Withhold reason: real test-coverage gap — the 3 `test-compute-indirect.cpp` cases mask out Metal (`D3D12|Vulkan|CUDA`); Metal path is compile-verified only, never executed. Doc flips Metal→"yes" without an executing test.
- **next-action:** human confirm on Metal HW / add a Metal test leg. On a later human-review webhook, `record_human_verdict` for agreement scoring.

See [[feedback_approver_never_posts_route_reviewer]].
