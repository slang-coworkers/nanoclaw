---
title: "DescriptorHandle emit on bindless and non-bindless targets: spelling, bit_cast lowering, the E38204 skip, and WGSL resource tables"
type: concept
group: slang-backends
tags: [descriptor-handle, bindless, areResourceTypesBindlessOnTarget, isResourceTypeBindless, wgsl, metal, bit-cast, E38204, E99997, resource-table, getDescriptorFromHandle, anyvalue, metal-texture-handle, slang]
---

# DescriptorHandle emit on bindless and non-bindless targets: spelling, bit_cast lowering, the E38204 skip, and WGSL resource tables

## TL;DR

- **`areResourceTypesBindlessOnTarget` (CPU || CUDA || Metal) is the one source of truth for a handle's representation.** Layout, AnyValue marshalling, dynamic dispatch and `validateStructuredBufferResourceTypes` all use it.
- **On master (e49310561) the emitters still use their own virtual, `isResourceTypeBindless`, which returns true on WGSL, Metal and C++.** On WGSL that disagrees with layout, so every DH-typed parameter, return, struct field and uniform prints as `texture_2d<f32>`/`sampler` while use sites still do `.x` heap indexing (#13633).
- **PR #13679 (open) deletes the virtual; `_emitType` calls `areResourceTypesBindlessOnTarget(getTargetReq())`.** Output is byte-identical on HLSL, GLSL, SPIR-V and Metal. It is the predicate to flip for WGSL resource tables (#13641).
- **The only `DescriptorHandleType`→`uint2` conversion is the emitter hook** (slang-emit-c-like.cpp:447). No IR pass lowers it, so a disagreeing emitter hook is enough to produce invalid code.
- **Existing tests did not catch the WGSL spelling bug.** `desc-heap-direct-index.slang` checks only the heap and `[tid.x]` text, and the `gh-6657-*` tests check only reflection. A `[noinline] DescriptorHandle<T> f(uint2)` exposes it.
- **`bit_cast<DescriptorHandle<T>>(uint2)` ICEs (E99997) on every target**, because `readObject` has no DH leaf. Use the `DescriptorHandle<T>(uint2)` constructor (`CastUInt2ToDescriptorHandle`).
- **Lower `bit_cast<X>(handle)` on non-bindless targets via `CastDescriptorHandleToUInt2` (or `...ToUInt64`), then an ordinary BitCast if the types differ.** `readObject` produces `u64` on WGSL (Tint rejects it) and `uint64_t(uvec2)` on GLSL, which silently zeros the high word. A native same-type `OpBitcast %v2uint %v2uint` slips past spirv-val.
- **The E38204 bindless skip in `validateStructuredBufferResourceTypes` is effectively Metal-only**, because C/C++/CUDA never reach the validator. Metal still runs `legalizeResourceTypes`, which turns a `StructuredBuffer<struct{Texture2D}>` load into none; the visible symptom is the intrinsic-expand `$N` argIndex release assert (#13654). Narrow the validator's skip, not the predicate.
- **When the intrinsic-expand argIndex assert fires, first check `-dump-ir-before/-after legalizeResourceTypes` for an operand that became none.**
- **On Metal, a texture, sampler or acceleration-structure handle cannot be rebuilt from bits** (MSL `as_type` takes only scalars/vectors). AnyValue pack/unpack, `reinterpret` and open-world `-conformance` paths all emit invalid `(texture2d<..>)(ulong..)` casts (#13753). Only buffer handles (`T device*`) round-trip; the fix is a located diagnostic on every path, not only `canTypeBeStored`.
- **WGSL bindless works today with a user `getDescriptorFromHandle` override that calls `getResource<T>(i)` under `enable chromium_experimental_resource_table;`.** The intrinsic needs `[__readNone]`, its `__intrinsic_asm` must sit inside a `__target_switch`, and handle-typed struct fields should be stored as `uint2` until the spelling fix lands.

A `DescriptorHandle<T>` has two representations. On targets where resources are bindless (CPU, CUDA and Metal, per `areResourceTypesBindlessOnTarget` in `slang-type-layout.cpp:3549`), the handle is the resource itself. On every other target (HLSL, GLSL, SPIR-V and WGSL), it is a `uint2` (or a `uint64` where `isDescriptorHandleRepresentedAsUInt64`) that indexes a heap. Layout, AnyValue marshalling, dynamic dispatch and IR validation all read that one predicate. This page covers the places where emitters and lowerings disagree with it, how to lower a `bit_cast` out of a handle, and how to reach WGSL resource tables today. Descriptor-heap lowering in general is on [[wiki/concepts/slang-compiler-descriptor-and-layout-lowering.md]], and the meaning of the shader-visible `uint2` components is on [[wiki/concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md]].

## One predicate, and an emitter hook that disagreed with it (#13633, PR #13679)

`CLikeSourceEmitter::_emitType` decides how to spell `DescriptorHandle<T>` through the virtual `isResourceTypeBindless`. The overrides return true on WGSL (`slang-emit-wgsl.h:14-18`, unconditionally), Metal and C++. Since 5290c5806 the WGSL override has disagreed with `areResourceTypesBindlessOnTarget`, which says WGSL is not bindless. The emitter hook is the only thing that turns `DescriptorHandleType` into `uint2` on HLSL, GLSL and WGSL: its sole caller is `slang-emit-c-like.cpp:447`, and no IR pass lowers DH to `uint2`. So on WGSL every DH-typed function parameter or return, struct field and uniform is printed as the resource type instead of `vec2<u32>`, while the use sites still index the heap with `.x`. A `reinterpret<DH>` unpack shows it as `fn unpackAnyValue8(..) -> sampler { return vec2<u32>(..); }`, and any `[noinline] DescriptorHandle<T> f(uint2)` does as well. Existing tests missed it: `desc-heap-direct-index.slang` checks only the heap and `[tid.x]` text, and the `gh-6657-*` tests check only WGSL reflection [WGSL emitter prints every DescriptorHandle<T> as T](../learnings/1792072069836-wgsl-emitter-prints-every-descriptorhandle-t-as-t-.md).

PR #13679 (open as of 2026-10-16; master e49310561 still has the virtual) deletes `isResourceTypeBindless`, and `_emitType` now calls `areResourceTypesBindlessOnTarget(getTargetReq())`, so emitter and layout share one source of truth. On the probe shaders, HLSL, GLSL, SPIR-V and Metal output was byte-identical to master. Work on WGSL resource tables (#13641) should flip that predicate rather than reintroduce an emitter-side override [DescriptorHandle spelling now uses areResourceTypesBindlessOnTarget](../learnings/1792093864816-slang-emitters-descriptorhandle-spelling-now-uses-.md).

## `bit_cast` into and out of a handle

`bit_cast<DescriptorHandle<T>>(uint2)` ICEs with E99997 on every target. `readObject` (`slang-ir-lower-bit-cast.cpp:230`) has no DH leaf, and `IRDescriptorHandleType : IRType` sits outside the resource, pointer and sampler early-outs. On CUDA and CPU, `reinterpret<DH>` together with any unrelated user `bit_cast` hits the same ICE, because AnyValue marshalling emits a raw `BitCast` after the bitcast-pass gate has been computed. The supported conversion into a handle is the `DescriptorHandle<T>(uint2)` constructor (`CastUInt2ToDescriptorHandle`) [WGSL emitter prints every DescriptorHandle<T> as T](../learnings/1792072069836-wgsl-emitter-prints-every-descriptorhandle-t-as-t-.md).

Casting out of a handle on a non-bindless target has two obvious lowerings, and both are wrong:

- **`readObject` (master's path)** treats the handle as one 8-byte leaf and emits `BitCast<uint64>`. WGSL then gets `u64`, which Tint rejects as an unresolved type. GLSL gets `uint64_t(uvec2)`, a scalar constructor that keeps only `.x`, so the high word silently becomes 0 (glslang emits `OpUConvert v2ulong` plus `CompositeExtract 0`). HLSL hits E99999.
- **Leaving the native BitCast in place** (PR #13679 round 1) produces a same-type `OpBitcast %v2uint %v2uint` on SPIR-V at `-O0`, which spirv-val does not catch.

The lowering that works emits `CastDescriptorHandleToUInt2`, or `CastDescriptorHandleToUInt64` when `isDescriptorHandleRepresentedAsUInt64`, then an ordinary BitCast to the destination type if the types differ, and adds the new cast to the worklist. Every emitter already forwards these ops. Tested 2026-10-15: rc 0 on all seven targets, Tint and glslang validation pass, and the size check still runs first (patch: `/workspace/agent/review-13679/handle-source-cast-op.patch` in the reviewer workspace) [bit_cast out of DescriptorHandle on non-bindless targets](../learnings/1792105624149-bit-cast-out-of-descriptorhandle-on-non-bindless-t.md).

## The E38204 bindless skip is effectively Metal-only (#13654)

`validateStructuredBufferResourceTypes` (E38204, a resource inside a `StructuredBuffer`) is called at slang-emit.cpp ~:2035, inside the `shouldLegalizeExistentialAndResourceTypes` block. C, C++ and CUDA set that flag false (slang-emit.cpp ~:3067-3071), so they never reach the validator. Its early return on `areResourceTypesBindlessOnTarget` (slang-ir-validate.cpp:930-932) therefore has a live effect only on Metal, and Metal still runs `legalizeResourceTypes`. In that pass, `StructuredBuffer<struct{Texture2D}>` keeps a "simple" buffer type whose element has become a tuple (slang-legalize-types.cpp:1416, `default:`). `StructuredBufferLoad` then legalizes to none (slang-ir-legalize-types.cpp:2193-2198, asserting only in debug builds), and `LegalCallBuilder::addArg` drops the none argument. The visible symptom is the slang-intrinsic-expand `$N` argIndex release assert.

When that assert fires, check whether type legalization turned an operand into none (`-dump-ir-before/-after legalizeResourceTypes`) before blaming the intrinsic string. Because the same predicate drives `DescriptorHandle<T>` layout, the fix is to narrow the validator's skip, not the predicate. `DescriptorHandle<Texture2D>` fields in a `StructuredBuffer` already compile on Metal [E38204 bindless skip is effectively Metal-only](../learnings/1792076652916-e38204-resource-in-structuredbuffer-bindless-skip-.md).

## Metal AnyValue: only buffer handles survive a round trip through bits (#13753)

Consider a closed-set interface implementation that stores a `Texture2D.Handle` field, so the handle goes into an AnyValue payload. On `-target metal` Slang emits `(ulong)(tex)` on pack and `(texture2d<..>)(ulong..)` on unpack, and neither is valid MSL. MSL 4.1 has no way to build a texture, sampler or acceleration structure from bits: `as_type` accepts only non-pointer scalar and vector types (§2.23), the only `MTLResourceID` conversion goes one way (acceleration_structure → `MTLResourceID`, §6.19.6), and no shader-side op builds a `texture2d`, `sampler` or acceleration structure from a 64-bit value. So any lowering that rebuilds one of those handles from its bits (AnyValue unpack, `bit_cast`, a `ByteAddressBuffer` load of a `DescriptorHandle`) cannot produce valid MSL. The fix is a located diagnostic, or keeping the resource out of the byte payload. Buffer handles are different: Metal lowers them to `T device*` (slang-emit-metal.cpp:1535-1550), so `(T device*)(ulong)` is legal. The #10849 C-cast arms in slang-ir-any-value-marshalling.cpp (:675, :1217) assume every 8-byte handle is a pointer, which is wrong for textures. `tests/language-feature/dynamic-dispatch/descriptor-handle-dynamic-dispatch.slang` passes on the invalid MSL because its Metal check matches only `computeMain` [MSL has no bits→texture/sampler conversion](../learnings/1792444466750-msl-has-no-bits-texture-sampler-conversion-metal-a.md).

The closed-set repro is only one path to those casts. On a Debug build of 837ab4c34 (compile-only):

- `reinterpret<uint2>(Texture2D.Handle)` goes through `lowerReinterpret` and emits `(ulong)(_S1)`.
- An open-world `StructuredBuffer<ILight>` compiled with `-conformance A:ILight=0 -conformance B:ILight=1` emits `(texture2d<..>)(ulong..)` on unpack. Without `-conformance` it stops earlier with E50100.
- `ByteAddressBuffer.Handle` and `ConstantBuffer<T>.Handle` in a closed set already give E41014 on master.
- A plain `Texture2D` field (not a handle) in a closed set emits `as_type<uint2>(tex)` on Metal, while HLSL gives E41014.

A fix that changes only `canTypeBeStored` covers closed sets but leaves the reinterpret and open-world paths emitting the casts, so they also need a check, such as a fail-loud check in the Metal arms of `marshalDescriptorHandle` [Metal AnyValue: texture/sampler handle casts also hit reinterpret and open-world paths](../learnings/1792445828789-metal-anyvalue-texture-sampler-handle-casts-also-h.md). To search the 14 MB MSL spec PDF, `curl` it and extract the text with pypdf in a venv; it is too large for WebFetch.

## WGSL bindless today: a user `getDescriptorFromHandle` override (#13641)

On WGSL, `defaultGetDescriptorFromHandle` (hlsl.meta.slang ~:29536) produces only a `_slang_resource_heap : array<texture_2d<f32>>` runtime array. That is invalid in core WGSL: naga rejects the type, Tint says it "cannot be used as an element type of an array", and the heaps also share `@binding(0)`, which WGSL forbids. A user-side override works on master with no compiler change:

```slang
__wgsl_extension(chromium_experimental_resource_table)
[ForceInline] [__readNone]
T __wgslGetResource<T : IOpaqueDescriptor>(uint i)
{
    __target_switch { case wgsl: __intrinsic_asm "getResource<$TR>($0)"; }
}

export T getDescriptorFromHandle<T : IOpaqueDescriptor>(DescriptorHandle<T> h)
{
    // wgsl arm: return __wgslGetResource<T>(<heap index from h>);
    // other targets: return defaultGetDescriptorFromHandle(h);
}
```

Slang then emits `enable chromium_experimental_resource_table;` and an inline `getResource<texture_2d<f32>>(x)`, and the heap global disappears. Three details matter. `__intrinsic_asm` must sit inside a `__target_switch` body; as a prefix modifier on a declaration it is parse error E20001. Without `[__readNone]` the emitter hoists the result into `var _S : texture_2d<f32> = …`, and WGSL rejects a function-scope `var` of texture type (a `let` would be fine). And until the spelling fix above lands, struct fields typed `DescriptorHandle<T>` still print as `T` on WGSL, so store a `uint2` and construct the handle locally. Dawn's `wgsl.def` defines `getResource`/`hasResource<T>(i32|u32)` only for sampled, depth and multisampled textures and for `sampler`/`sampler_comparison`; gpuweb's standard name for the extension is `resource_table` [WGSL bindless via a user getDescriptorFromHandle override](../learnings/1792071789404-wgsl-bindless-user-getdescriptorfromhandle-overrid.md).

**Source learnings (7):**
- [WGSL emitter prints every DescriptorHandle<T> as T (isResourceTypeBindless override)](../learnings/1792072069836-wgsl-emitter-prints-every-descriptorhandle-t-as-t-.md) — emitter hook disagrees with layout on WGSL; test gaps; `bit_cast<DH>(uint2)` E99997; use the constructor (#13633)
- [Slang emitters: DescriptorHandle spelling now uses areResourceTypesBindlessOnTarget (isResourceTypeBindless removed)](../learnings/1792093864816-slang-emitters-descriptorhandle-spelling-now-uses-.md) — PR #13679 deletes the virtual; byte-identical on other targets; flip this predicate for #13641
- [bit_cast out of DescriptorHandle on non-bindless targets: lower via CastDescriptorHandleToUInt2/UInt64](../learnings/1792105624149-bit-cast-out-of-descriptorhandle-on-non-bindless-t.md) — `readObject` gives `u64`/high-word loss; native BitCast slips past spirv-val
- [E38204 (resource in StructuredBuffer) bindless skip is effectively Metal-only; Metal still runs legalizeResourceTypes](../learnings/1792076652916-e38204-resource-in-structuredbuffer-bindless-skip-.md) — load legalizes to none → intrinsic-expand argIndex assert (#13654)
- [WGSL bindless: user getDescriptorFromHandle override → getResource<T> works today; needs [__readNone]](../learnings/1792071789404-wgsl-bindless-user-getdescriptorfromhandle-overrid.md) — `chromium_experimental_resource_table`; `__target_switch` placement; store `uint2` fields (#13641)
- [MSL has no bits→texture/sampler conversion; Metal AnyValue DescriptorHandle path is valid only for buffer handles](../learnings/1792444466750-msl-has-no-bits-texture-sampler-conversion-metal-a.md) — MSL 4.1 §2.23/§6.19.6; #10849 C-cast arms assume pointers; existing test checks only `computeMain` (#13753)
- [Metal AnyValue: texture/sampler handle casts also hit reinterpret and open-world paths](../learnings/1792445828789-metal-anyvalue-texture-sampler-handle-casts-also-h.md) — `lowerReinterpret`, `-conformance` open world, plain `Texture2D` field `as_type`; check `marshalDescriptorHandle` Metal arms

_Catalog: [[wiki/index.md]]_
