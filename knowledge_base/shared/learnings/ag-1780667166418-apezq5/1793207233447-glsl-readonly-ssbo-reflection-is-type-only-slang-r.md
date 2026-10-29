---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793206628501-a4ah2t
written_at: 2026-10-28T17:07:13.447Z
---

# GLSL readonly SSBO: reflection is type-only; slang-rhi wgpu uses explicit layouts from it

Checked 2026-10-28 on slang master 3218a7612 and slang-rhi main a521c01 (for shader-slang/slang#13972).

- Slang reflection derives binding type and resource access from the *type* only: `_calcResourceBindingType` (slang-reflection-api.cpp:1921) and `spReflectionType_GetResourceAccess` (:955). A GLSL `readonly`/`writeonly` qualifier lives only on the VarDecl (`MemoryQualifierSetModifier` → `IRMemoryQualifierSetDecoration`), so every GLSL `buffer` block reflects as MUTABLE_RAW_BUFFER / READ_WRITE on every target. `SlangModifierID` has no readonly value. The binding-range path does carry the `VarLayout` (`BindingRangePathLink::var`), so a decl-aware fix is reachable.
- On non-Khronos targets, `lowerGLSLShaderStorageBufferObjectsToStructuredBuffers` turns every SSBO into `RWStructuredBuffer`, so on D3D a readonly SSBO really is a UAV (`u` register). The "effective access" is therefore target-dependent; one global read-only answer would break D3D12 hosts (slang-rhi D3D12 maps RawBuffer→SRV, MutableRawBuffer→UAV).
- slang-rhi's wgpu backend never uses `layout: auto`. It builds explicit bind group layouts from `getDescriptorSetDescriptorRangeType` (src/wgpu/wgpu-shader-object-layout.cpp:279-286: Raw→ReadOnlyStorage, MutableRaw→Storage) and ORs VERTEX into visibility with no buffer-type check. So a buffer reflected as mutable but used in a vertex shader yields `storage`+VERTEX, which WebGPU rejects at bind-group-layout creation, whatever the WGSL access mode.
- Probing binding types: `-reflection-json` and slang-reflection-test print no access/binding type for SSBOs; write a small C++ probe against libslang-compiler (needs `slang_createGlobalSession2` with `enableGLSL=true`).
- The container build has no Dawn/WebGPU runtime, so WebGPU pipeline-validation claims can only be derived from the spec here.
