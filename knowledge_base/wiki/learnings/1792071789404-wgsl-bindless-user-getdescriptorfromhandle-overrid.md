---
title: "WGSL bindless: user getDescriptorFromHandle override → getResource<T> (chromium_experimental_resource_table) works today; needs [__readNone]"
type: learning
topic: slang-compiler
source: learnings/1792071789404-wgsl-bindless-user-getdescriptorfromhandle-overrid.md
---

# WGSL bindless: user getDescriptorFromHandle override → getResource<T> (chromium_experimental_resource_table) works today; needs [__readNone]

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070213940-c9g7tq
written_at: 2026-10-15T13:43:09.404Z
---

# WGSL bindless: user getDescriptorFromHandle override → getResource<T> (chromium_experimental_resource_table) works today; needs [__readNone]

On WGSL, `defaultGetDescriptorFromHandle` (hlsl.meta.slang ~29536) only produces a `_slang_resource_heap : array<texture_2d<f32>>` runtime array. That is invalid in core WGSL: naga rejects the type, Tint says "cannot be used as an element type of an array", and both heaps also share @binding(0). A user-side fix that works on master with no compiler change: define a wgsl-only intrinsic `__wgsl_extension(chromium_experimental_resource_table) [ForceInline] [__readNone] T __wgslGetResource<T:IOpaqueDescriptor>(uint i){ __target_switch { case wgsl: __intrinsic_asm "getResource<$TR>($0)"; } }` and `export T getDescriptorFromHandle<T:IOpaqueDescriptor>(DescriptorHandle<T> h)` that returns it for wgsl and `defaultGetDescriptorFromHandle(h)` otherwise. Slang then emits `enable chromium_experimental_resource_table;` + inline `getResource<texture_2d<f32>>(x)`, and the heap global goes away.
Gotchas:
(1) `__intrinsic_asm` must sit inside a `__target_switch` body. As a prefix modifier on a decl it's a parse error E20001.
(2) Without `[__readNone]` the emitter hoists the result into `var _S : texture_2d<f32> = …`, and WGSL rejects a function-scope var of texture type (a `let` is fine).
(3) Struct fields typed `DescriptorHandle<T>` still print as `T` on WGSL (`WGSLSourceEmitter::isResourceTypeBindless` returns true, slang#13633), so store `uint2` and construct the handle locally until that lands.
Dawn wgsl.def: getResource/hasResource<T>(i32|u32) for sampled, depth and MS textures and sampler/sampler_comparison only. gpuweb's standard name is `resource_table`. (slang#13641, 2026-10-15)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792071789404-wgsl-bindless-user-getdescriptorfromhandle-overrid.md`_
