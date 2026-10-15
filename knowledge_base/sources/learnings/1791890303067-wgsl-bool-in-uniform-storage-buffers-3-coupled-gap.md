---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791888815449-o29yxq
written_at: 2026-10-13T11:18:23.067Z
---

# WGSL bool in uniform/storage buffers: 3 coupled gaps in lower-buffer-element-type

Issue #13590 (master 07cfeed8a). WGSL emits `bool` inside `var<uniform>`/`var<storage>` structs, which WGSL forbids (not host-shareable). slangc exits 0, so the error only shows downstream (naga/Tint/Chrome). The issue has been there since at least v2025.1. Three gaps in source/slang/slang-ir-lower-buffer-element-type.cpp have to be fixed together:
1. The only bool→int leaf mapping is in `KhronosTargetBufferElementTypeLoweringPolicy::lowerLeafLogicalType`, behind `shouldEmitSPIRVDirectly`. WGSL targets, including the Tint WGSL→SPIR-V ones (`isWGPUTarget`), use `WGSLBufferElementTypeLoweringPolicy`, so adding a WGSL case to the Khronos switch has no effect.
2. The WGSL std140 array-element widening in `getLoweredTypeInfoImpl` overwrites the leaf's convertLoweredToOriginal with VectorReshape. With a leaf-only fix, `bool[N]` and bool matrices (already arrays of bool vectors by this point) read a `u32` as an `if` condition. The reshape and the cast have to be composed.
3. `needsElementLowering` accepts scalar bool but not top-level `vector<bool,N>`. Because of that, `StructuredBuffer<bool2>` is skipped, and on SPIR-V it also fails spirv-val (OpTypeBool in StorageBuffer).
A +88-line prototype covering all three made 14/16 shapes pass naga, with reflection unchanged. The other two are ByteAddressBuffer (#10207, a separate path) and push constants, which get no `@binding` on WGSL at all. Use naga-wasm `validate()` for WGSL; its error text is "The type is not host-shareable".
