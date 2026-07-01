---
title: "spvDescriptorHeapEXT stride is opaque for AS — load-type must drive runtime-array base type"
type: learning
topic: misc
source: learnings/1779962007180-spvdescriptorheapext-stride-is-opaque-for-as-load-.md
---

# spvDescriptorHeapEXT stride is opaque for AS — load-type must drive runtime-array base type

## Context

When emitting a `DescriptorHandle<RaytracingAccelerationStructure>` load under the `spvDescriptorHeapEXT` capability, the SPIR-V emitter constructs an `OpUntypedAccessChainKHR` over a runtime array, then `OpLoad uint64` and `OpConvertUToAccelerationStructureKHR`. The driver lays out AS descriptors as 64-bit device addresses, so the load is always 8 bytes wide.

## The trap

If you derive the runtime-array element type from the *resource type* (`RaytracingAccelerationStructure` → `OpTypeAccelerationStructureKHR`), the array stride decoration becomes `OpConstantSizeOfEXT(uint, OpTypeAccelerationStructureKHR)`. The SPIR-V spec does not pin `SizeOf(OpTypeAccelerationStructureKHR)` — it is opaque/implementation-defined. On a driver where the reported size is not 8, `heap[i]` for `i > 0` resolves to the wrong byte offset; the subsequent `OpLoad uint64` reads garbage and `OpConvertUToAccelerationStructureKHR` produces an invalid handle.

## How to spot it

In `slang-emit-spirv.cpp` look at the helper that handles AS-from-heap (around `:7128` as of PR #11209). If it passes the AS type into `getDescriptorHeapBaseType` / `getDescriptorRuntimeArrayType`, you have the bug. Tests that force `-spirv-resource-heap-stride <N>` mask it because that flag pins `OpDecorateId %heap_array ArrayStrideIdEXT %N` directly, bypassing `OpConstantSizeOfEXT`.

## Fix

Drive the runtime-array element type from the *load type*, not the resource type. For AS this is `uint64`:

```cpp
auto u64Type = ensureInst(builder.getUInt64Type());
auto baseRuntimeArray = getDescriptorRuntimeArrayType(u64Type);
// then OpUntypedAccessChainKHR into baseRuntimeArray
```

This makes the array stride decoration well-defined as 8 and matches the `OpLoad uint64` width.

## Test gap to also flag

Any new SPIR-V backend test for descriptor-heap-of-AS should include at least one case that *omits* `-spirv-resource-heap-stride` so the default-stride emission path is filecheck-pinned. Otherwise a future regression in the base-type/stride strategy slips through silently.

## Related

GitHub issue shader-slang/slang#10671 (the bug this fix targeted at the surface level — `OpConvertUToAccelerationStructureKHR` was missing entirely; symptom was `VK_ERROR_DEVICE_LOST`). The fix adds the conversion but leaves the deeper stride hazard.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779962007180-spvdescriptorheapext-stride-is-opaque-for-as-load-.md`_
