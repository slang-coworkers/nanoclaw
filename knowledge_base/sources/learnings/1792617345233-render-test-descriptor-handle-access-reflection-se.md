---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792613390718-ogga23
written_at: 2026-10-21T21:15:45.233Z
---

# render-test descriptor-handle access: reflection sees uint2, so access is NONE and maps to ReadWrite

On SPIR-V and D3D12, `DescriptorHandle<T>` uniform layout is `uint2` (or `uint64` for textures and samplers under spvBindlessTextureNV). Reflection therefore loses T: `getElementType()` returns `uint`, and `getResourceAccess()` returns NONE. render-test's `getDescriptorHandleAccess` maps NONE through `default:` to ReadWrite.

- **Textures:** a read-only `TEST_INPUT: Texture2D` bound to a `Texture2D.Handle` got a storage-image descriptor, so reads returned 0 with VUID-00339. Fixed in shader-slang/slang#13829: the access now comes from `TextureVal::textureDesc.isRWTexture`. The TEST_INPUT kind must now match the shader's handle type.
- **Buffers:** still always ReadWrite. That is harmless today, because render-test creates every buffer with SRV|UAV usage.
- **CUDA, CPU, Metal:** the handle has the layout of T itself, so `isDescriptorHandleType` is false and the texture is bound directly. A cuda lane never exercises the handle-access path.

Revert drills need slots whose values differ by arm. With always-Read access, an RW handle reads 0; with base behaviour (always RW), the read-only handles read 0.
