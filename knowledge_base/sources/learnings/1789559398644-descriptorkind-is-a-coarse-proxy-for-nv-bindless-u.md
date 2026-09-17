---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789415821326-ntd2hj
written_at: 2026-09-16T11:49:58.644Z
---

# DescriptorKind is a coarse proxy for NV-bindless uint64 representation — gate on the IR type

In Slang's core module (`hlsl.meta.slang`), whether a `DescriptorHandle<T>` is a **native `uint64` bindless handle** under `spvBindlessTextureNV` is decided by the C++ classifier `isBindlessTextureNVEncodableResourceType` = `as<IRTextureType>(t) || as<IRSamplerStateTypeBase>(t)` (`slang-ir-util.cpp`). Meta-code that instead tests `T.kind == DescriptorKind.Texture || ... UniformTexelBuffer || ...` is **wrong**: `DescriptorKind` is coarser than the IR type.

Concrete traps (shader-slang/slang#13070 / PR #13086):
- `SubpassInput` (`__SubpassImpl`) declares `kind = DescriptorKind.Texture` but lowers to `IRSubpassInputType` (NOT `IRTextureType`) → not NV-encodable.
- `TextureBuffer<T>` declares `kind = DescriptorKind.UniformTexelBuffer` but lowers to `IRTextureBufferType` → not NV-encodable.
Routing either to `__castDescriptorHandleToResource<T>` under `spvBindlessTextureNV`+`spvDescriptorHeapEXT` aborts with the internal error `Unsupported result type for CastDescriptorHandleToResource`. All `_Texture<...>` instances (incl. `Buffer`/`RWBuffer` buffer-shape) ARE `IRTextureType`, so they're fine; only the two odd types above share a kind without being the type.

Fix pattern that worked: add a per-type `static const bool isBindlessTextureNVEncodable` requirement on `IOpaqueDescriptor` (mirrors the existing `kind`/`descriptorAccess` requirements), define it `true` for `_Texture`/samplers and `false` otherwise (the FIDDLE loop's existing `isSampler` bit is exactly right for the generated types), and use it everywhere the coarse kind-list appeared (dispatch, ctor diagnostics, `DescriptorHandle.lessThan`/`lessThanOrEquals`). A stronger single-source alternative is a `__isBindlessTextureNVEncodable<T>()` intrinsic that folds in `slang-ir-peephole.cpp` by calling the C++ classifier directly (mirror the existing `__isInt`/`__isVector` family in `core.meta.slang` + a new op in `slang-ir-insts.lua`/`-stable-names.lua`).

Verify representation regressions empirically against a prebuilt unfixed `slangc` (e.g. the base clone at `/workspace/agent/slang/build/Debug/bin/slangc`): compile the case under NV-only / EXT-only / NV+EXT and diff the opcodes — that's how the ICE-vs-EXT-heap regression was pinned.
