---
title: "DescriptorHandle uint2 component semantics (shader-visible, HLSL/GLSL/SPIR-V)"
type: learning
topic: slang-compiler
source: learnings/1788849400575-descriptorhandle-uint2-component-semantics-shader-.md
---

# DescriptorHandle uint2 component semantics (shader-visible, HLSL/GLSL/SPIR-V)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788849065734-y9o9re
written_at: 2026-09-08T06:36:40.575Z
---

# DescriptorHandle uint2 component semantics (shader-visible, HLSL/GLSL/SPIR-V)

Verified against `source/slang/hlsl.meta.slang` (HEAD, Sep 2026) while reviewing docs PR #12938. Distinct from the host/runtime `uint64` packing (D3D12 2×32-into-64, Metal 128b) already in the wiki — this is the **shader-visible** `uint2` on HLSL/GLSL/SPIR-V/WGSL.

- **Ordinary handle (single texture/sampler/buffer/CBV):** `.x` = index into the resource *or* sampler heap/array; `.y` unused. Default heap-derived construction is literally `uint2(index, 0)` (`:27568`, `:27853` resource; `:27864` sampler). Every lookup reads only `.x` (Sampler `:27970`, Texture `:27976/78`, texel/constant/storage buffers `:27982–27997`, HLSL `:28026/30`, WGSL `:28049`, spvDescriptorHeapEXT `:28052/56`). So for ordinary handles the `uint2` is **not** a 64-bit low/high split — a real reader misconception (issue #12937).
- **Acceleration structure:** the `uint2` genuinely *is* a 64-bit value — `RaytracingAccelerationStructure(__asuint64((uint2)handleValue))` on the default SPIR-V/GLSL path (`:28000`), used as a GPU address. But only "on some targets": HLSL loads AS from the resource heap by `.x` (`:28030`). So any "not a 64-bit split" statement must be scoped to *ordinary* handles.
- **Combined texture-sampler:** `.x`=texture (resource heap), `.y`=sampler (sampler heap) — but *only in the split lowering* (HLSL/spvDescriptorHeapEXT via `__makeCombinedTextureSamplerFromHandle`). The native SPIR-V combined-image-sampler path (VkMutable) indexes by `.x` alone (`:27972`). So "the split representation" is the correct qualifier.
- **Reviewer takeaway for descriptor-handle docs:** the three special cases (ordinary=`.x`/`.y`=0, AS=`__asuint64` GPU address, combined-sampler split) each need explicit scoping words ("ordinary", "on some targets", "the split representation"). A blanket claim about `uint2` semantics will be wrong for one of them. Cross-check any such doc against the `defaultGetDescriptorFromHandle` / `getDescriptorFromDynamicResourceHeap` target switches, which are the behavioral source of truth.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788849400575-descriptorhandle-uint2-component-semantics-shader-.md`_
