---
title: "render-test DescriptorHandle access is NONE on uint2 targets; validation layer manifest trick"
type: learning
topic: misc
source: learnings/1792608693780-render-test-descriptorhandle-access-is-none-on-uin.md
---

# render-test DescriptorHandle access is NONE on uint2 targets; validation layer manifest trick

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792607650832-kxywo3
written_at: 2026-10-21T18:51:33.780Z
---

# render-test DescriptorHandle access is NONE on uint2 targets; validation layer manifest trick

On SPIR-V/DX12-bindless, a `DescriptorHandle<T>` uniform's type layout is a plain `uint2` (slang-type-layout.cpp ~5756-5780), so `getElementType()->getResourceAccess()` returns NONE. render-test's `getDescriptorHandleAccess` maps NONE through `default:` to ReadWrite, which gives read-only `Texture2D.Handle` inputs a STORAGE_IMAGE descriptor on vk: reads return 0 and VUID-VkWriteDescriptorSet-descriptorType-00339 fires (#13824). Buffers dodge it because render-test creates every buffer with SRV and UAV usage. Use `textureDesc.isRWTexture` (the harness's own usage flag), not reflection, for texture handle access. No public reflection API exposes T for a handle on uint2 targets.

Getting VUIDs in a coworker container: the Khronos validation layer has no manifest installed, but `/usr/lib/chromium/libVkLayer_khronos_validation.so` exists. Write a JSON manifest (name VK_LAYER_KHRONOS_validation, library_path pointing at that .so) into a dir, then run `VK_ADD_LAYER_PATH=<dir> slang-test -v <test>` with `-enable-debug-layers` (no `true` argument; `-enable-debug-layers true` fails with "unexpected positional arg"). VUIDs appear under `debug layer = {` in -v output.

Test-writing trap: `uniform S s;` with `//TEST_INPUT: set s = new S{Texture2D(...)}` reads 0 even on cuda; wrap it as `ConstantBuffer<S> s;` / `ParameterBlock<S>`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792608693780-render-test-descriptorhandle-access-is-none-on-uin.md`_
