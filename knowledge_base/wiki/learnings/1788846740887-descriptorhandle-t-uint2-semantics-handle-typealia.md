---
title: "DescriptorHandle<T> uint2 semantics + .Handle typealias (bindless)"
type: learning
topic: misc
source: learnings/1788846740887-descriptorhandle-t-uint2-semantics-handle-typealia.md
---

# DescriptorHandle<T> uint2 semantics + .Handle typealias (bindless)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788846272567-xcgl3j
written_at: 2026-09-08T05:52:20.887Z
---

# DescriptorHandle<T> uint2 semantics + .Handle typealias (bindless)

Grounded answers to common bindless `DescriptorHandle` usage questions (verified against `source/slang/hlsl.meta.slang`, `slang-emit-c-like.cpp`, user-guide `03-convenience-features.md:601+`, proposal SP#015; corroborated by DeepWiki). From triaging shader-slang/slang#12937.

- **`.Handle` is a member TYPE ALIAS, not a function**: `typealias Handle = DescriptorHandle<This>`. So `StructuredBuffer<float4>.Handle` == `DescriptorHandle<StructuredBuffer<float4>>`. Defined ONLY on `IOpaqueDescriptor` types (textures, samplers, all Structured/ByteAddress buffers, ConstantBuffer, TextureBuffer, RaytracingAccelerationStructure, SubpassInput). `hlsl.meta.slang:27549 / :27649 / :27581`.

- **The `uint2` is TWO independent heap indices, NOT a 64-bit low/high split** (the common misread). For a **plain single-descriptor resource** (Texture2D, StructuredBuffer, SamplerState…): `.x` = index into the global descriptor/resource heap, `.y` = **unused** (built as `uint2(index,0)`). For a **combined texture-sampler** (`DescriptorHandle<Sampler2D>`): `.x` = texture's index in the resource heap, `.y` = sampler's index in the sampler heap → emits `ResourceDescriptorHeap[s.x]` + `SamplerDescriptorHeap[s.y]`. A distinct `uint64_t` rep exists only under `spvBindlessTextureNV`/CUDA (`slang-ir-util.cpp:3429-3437`).

- **`ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[j]`** are `static const` global built-in objects (HLSL SM6.6 source-compat). Indexing returns an **untyped handle** (`UntypedResourceHandle`); the concrete result type is recovered from the **assignment LHS type** via implicit conversion — so `Texture2D t = ...` (dereferences to the resource) and `Texture2D.Handle th = ...` (keeps the handle) both compile from the same RHS. `DescriptorHandle<T>` also implicitly converts to `T` (`__init(DescriptorHandle<This>)`, cost `kConversionCost_ImplicitDereference`). Heap-family mismatch (sampler from resource heap, etc.) is a compile error.

- **Lowering site**: `DescriptorHandle<T>` → `uint2` at emit in `slang-emit-c-like.cpp:443-459` (emits `T` directly when `isResourceTypeBindless(T)`, else `uint2`); SPIR-V `slang-emit-spirv.cpp:2843`, Metal `:1323`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1788846740887-descriptorhandle-t-uint2-semantics-handle-typealia.md`_
