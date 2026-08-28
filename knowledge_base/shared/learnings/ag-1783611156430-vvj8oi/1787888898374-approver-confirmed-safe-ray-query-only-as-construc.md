---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787792237683-ycfjo8
written_at: 2026-08-28T03:48:18.374Z
---

# [approver/confirmed-safe] Ray-query-only AS-constructor extension leak fix (slang#12694/#12696) merged as-decided

**Outcome:** WOULD_APPROVE on slang#12696 @ `51c881440be8` was confirmed correct — jkwak-work MERGED that exact commit (2026-08-28T03:46:56Z) after also APPROVING it. My decision commit == the merged head; the two earlier decided revisions (`d4bd6163`, `4eee56de`) are ancestors of the merged head (superseded revisions of the same fix). Zero human follow-up commits between my read and the shipped change ⇒ a clean agreement, no false-safe.

**The class of change, and why it was safe (transferable signal for Step-0 recall):** Removing a hard-coded `OpExtension "SPV_KHR_..."` from a core-module intrinsic's `spirv_asm` body when a deferred emitter mechanism already covers it. Specifically: `RaytracingAccelerationStructure.__init(uint64_t)` hard-coded `OpExtension "SPV_KHR_ray_tracing"`, which the emitter hoists verbatim, leaking it into ray-query-only modules (Vulkan VUID-VkShaderModuleCreateInfo-pCode-08742). The fix deletes the line and relies on the SPIR-V type-emit's "any"-extension group at `slang-emit-spirv.cpp:2865-2870` (`ensureAnyExtensionDeclaration({SPV_KHR_ray_tracing, SPV_KHR_ray_query})`), resolved at finalization by `emitSPIRVAnyExtension` (`:1835-1854`): declares `options[0]` only if no group member is already concretely declared. A RayQuery use declares `SPV_KHR_ray_query` directly (`:2872-2874`) → group collapses to ray_query.

**What made the challenger conclusive (the probes that carried bits):**
1. The three-path coverage argument is only sound if you confirm the OTHER two paths still declare their extension directly: ray-tracing pipelines via TraceRay intrinsics (`:6360-6361`, `:6684-6697`); AS-with-no-ray-use falls back to `options[0]`=ray_tracing (`:1851`). Confirm all three, not just the fixed one.
2. The sibling `emitAccelerationStructureFromDescriptorHeap` (`:7599-7601`) already uses this exact "any" pattern for the same `OpConvertUToAccelerationStructureKHR` opcode — precedent that the deferred mechanism is the intended layer.
3. A revert drill (rebuild with only the line removed) turns the direct `-target spirv-asm` output from leaking `SPV_KHR_ray_tracing` (no `RayTracingKHR`) to `RayQueryKHR`+`SPV_KHR_ray_query` only — a genuine positive control (pre-fix the test's `CHECK-NOT` fails).
4. The test's second RUN line `-emit-spirv-via-glsl` was already clean pre-fix (glslang reconstructs the extension set from used caps), so the added CHECK-NOT there passes independently of the fix — worth checking so you don't attribute via-glsl cleanliness to the fix.

This is NOT a new-flag/new-gate or capdef PR, so the gate-PR positive-control and capdef-ref-doc challenger branches don't apply (they'd produce spurious ABSTAINs if forced).
