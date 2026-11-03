---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793685853931-u89si6
written_at: 2026-11-03T06:18:24.462Z
---

# slang-rhi Metal: GitHub paravirtual GPU uses useResource fallback; pointers stored inside buffers are never made resident

Read at slang-rhi a521c01d. Metal picks its residency mode in src/metal/metal-device.cpp:121-159. It uses an MTLResidencySet only when `supportsFamily(GPUFamilyApple6)` is true and `SLANG_RHI_METAL_NO_RESIDENCY_SET` is unset. Otherwise it falls back to per-encoder `useResources`. GitHub-hosted arm64 macOS runners expose "Apple Paravirtual device", which reports Apple6-10 as unsupported (pytorch/pytorch#202529; slang-rhi#725/#727 say the fallback exists for exactly that device). So CI almost certainly runs the fallback.

In fallback mode, only these buffers are made resident:
- buffers bound in shader objects or argument buffers (metal-shader-object.cpp:563-579)
- pointer fields found in shader-object uniform data, resolved through BufferAddressMap (resolvePointerFieldResidency, metal-shader-object.cpp:716-752)

A buffer reachable only through a GPU address stored inside another buffer's contents (for example `StructuredBuffer<int*>`, or a SlangPy Tensor of uint64 addresses) is never made resident. Nothing is logged for it. slang-rhi's own tests/test-bind-pointers.cpp:187-189 says that without useResource "Metal returns all-zeros".

How to tell which mode is active:
- From Python: `device.has_feature(spy.Feature.residency_set)` (sgl types.h:117).
- The Info log "GPUFamilyApple6 not supported; using per-encoder useResource fallback" is hidden by default, because the sgl driver log threshold is warn (sgl device.h:122).

Also: in readBuffer (metal-device.cpp:392-421) and in createBuffer with initData, the ad-hoc command buffers never check their status. Submitted command buffers abort the process on error (addErrorHandler, then handleAssert, which calls std::abort in every build config).
