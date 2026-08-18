---
title: "Diagnosing DescriptorHandle&lt;RaytracingAccelerationStructure&gt; + spvDescriptorHeapEXT crashes"
type: learning
topic: ci-tooling
source: learnings/1785051051163-diagnosing-descriptorhandle-lt-raytracingaccelerat.md
---

# Diagnosing DescriptorHandle&lt;RaytracingAccelerationStructure&gt; + spvDescriptorHeapEXT crashes

When a user reports a crash with `DescriptorHandle<RaytracingAccelerationStructure>` + `spvDescriptorHeapEXT` (RayQuery *or* TraceRay), the compiler path is **supported and regression-tested** on builds ≥ v2026.11 — so the crash is almost always runtime/host-side, not a Slang bug. Verified 2026-07-26 against source (`tests/spirv/descriptor-heap-acceleration-structure.slang` = RayQuery/compute; `-raygen.slang` = TraceRay/raygeneration). No known open compiler bug on this path.

**Key facts (verified via docs/user-guide/03-convenience-features.md + tests + DeepWiki):**
- `DescriptorHandle<T>` on SPIR-V (default, no `spvBindlessTextureNV`) = **`uint2`, 8 bytes, 4-byte aligned**. With `spvBindlessTextureNV` it's a `uint64` instead.
- **Two distinct values people conflate:** (a) the **handle `uint2`** in the CB/push-constant = `(slotIndex, 0)` — `.x` is a RAW heap index (no packing), `.y=0` for plain resources (`.y` is only the sampler index of a combined texture-sampler). (b) the **heap slot** contents = the **8-byte AS device address** (`vkGetAccelerationStructureDeviceAddressKHR`, NOT the opaque `VkAccelerationStructureKHR`).
- Compiler auto-emits `OpUntypedAccessChainKHR`(by `.x`) → `OpLoad %u64` → `OpConvertUToAccelerationStructureKHR`. User never writes `.x`/`.y` in shader code.
- **Capabilities differ by ray API:** `TraceRay` (DXR pipeline) needs `RayTracingKHR` + `SPV_KHR_ray_tracing`; `RayQuery`/`TraceRayInline` needs `RayQueryKHR` + `SPV_KHR_ray_query`. The heap-AS load path works in both. `spvDescriptorHeapEXT` itself pulls in `SPV_EXT_descriptor_heap` + `SPV_KHR_untyped_pointers`.

**Diagnosis order (decisive first):**
1. Dump `-target spirv-asm`, grep `OpConvertUToAccelerationStructureKHR`. Missing → old build (#10671/PR#11209), reads opaque handle not u64 → DEVICE_LOST. Present → compiler fine.
2. VK validation layers + GPU-assisted validation. Hard DEVICE_LOST with no msg → bad device address in the slot.
3. Bisect: does RayQuery-with-same-heap-TLAS work? If yes, crash is in RT pipeline/SBT (group-handle stride/alignment), not the descriptor heap. Slot 0 works but ≥1 crashes → **stride mismatch** (#11231/PR#11494): default AS stride = 8 bytes post-2026-06-16; a unified heap with a larger fixed slot needs `-spirv-resource-heap-stride <slotBytes>`. This is a SILENT miscompile, no validation error.

**Two distinct models (see also corrections.md 2026-06-19):** plain-bindless `DescriptorHandle` (backed by `__DynamicResource[]`) vs `spvDescriptorHeapEXT`. Confirm which the user is on before anchoring the answer — the AS convert opcode is shared but the handle means different things. The stride fixes (#11231/#11494) are heap-capability-specific.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785051051163-diagnosing-descriptorhandle-lt-raytracingaccelerat.md`_
