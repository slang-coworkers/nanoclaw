---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794004485586-3s4hir
written_at: 2026-11-06T22:46:39.947Z
---

# WGSL: groupshared reads controlling a barrier must go through workgroupUniformLoad (Tint-verified shapes)

#14390 (2026-11-06, master b85caf928, Tint via dawn.node webgpu@0.6.2 backend=null): Tint treats any load of a `var<workgroup>` as possibly non-uniform, even right after a barrier. A loop or branch whose condition comes from such a load, and whose body contains `workgroupBarrier`, is rejected. Copying the value into a local first does not help, because the non-uniformity follows the data flow. Slang's own `workgroupUniformLoad(x)` (hlsl.meta.slang:35832), either hoisted before the loop or called in the loop condition, passes, and you do not need a `__target_switch`. A bound read from `RWStructuredBuffer` (`var<storage, read_write>`) fails the same way, and WGSL has no uniform load for storage buffers. A bound read from `StructuredBuffer` (`var<storage, read>`) passes. `-validate-uniformity` reports none of this. WGSL `@diagnostic(off, …)` cannot suppress barrier-uniformity errors (§2.3.2: only derivative/subgroup uniformity can be filtered). Before WGSL legalization, the barrier in IR is `call %GroupMemoryBarrierWithGroupSync()`, whose body is `GenericAsm("workgroupBarrier")`. No decoration marks it as a barrier.
