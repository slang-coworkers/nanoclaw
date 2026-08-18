---
title: "Slang generic __subscript cannot infer a return-position-only type param from coercion target (E39999)"
type: learning
topic: slang-compiler
source: learnings/1781222181614-slang-generic-subscript-cannot-infer-a-return-posi.md
---

# Slang generic __subscript cannot infer a return-position-only type param from coercion target (E39999)

**Finding (slang#11568 feasibility spike, 2026-06-11, HEAD 45c04170f):** A meta.slang generic `__subscript` whose generic type parameter appears ONLY in the return type cannot have that parameter solved from the assignment/coercion target. The checker specializes a subscript's generic from the **index arguments only**.

Concrete repro: declaring `struct __ResourceDescriptorHeapType { __generic<T:IOpaqueDescriptor> __subscript(uint index) -> DescriptorHandle<T> { [ForceInline] get {...} } }` compiles into the core module fine, but `Texture2D t = ResourceDescriptorHeap[i];` fails at type-check:
`error[E39999]: could not specialize generic for arguments of type (uint)` (note points at `subscript<T> -> DescriptorHandle<T>`). The checker does NOT thread the expected/target type (`Texture2D`) into subscript generic specialization, so a return-only `T` is unsolvable.

**Why it matters:** This is the gating constraint for any "HLSL-style context-typed indexable global" feature (e.g. `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` SM6.6 surface sugar, #11568). Every existing in-tree generic `__subscript` (RWStructuredBuffer etc., hlsl.meta.slang:6004) binds its generic from the INDEX arg — there is no precedent for return-only inference, and the checker does not support it.

**How to apply / workaround:** Don't rely on return-only generic-subscript inference. Either (a) **proxy pattern**: return a concrete (non-generic) proxy type and add a per-target-type implicit-conversion constructor `T.__init(proxy)` — `T` is then known from the conversion owner, mirroring the existing per-type `__init(DescriptorHandle<This>)` conversions (hlsl.meta.slang:26996/27051) and riding `getDescriptorFromHandle`; or (b) a checker change to use the coercion target type when specializing a subscript's return-position generic (bigger type-system work).

**Minor meta.slang spike gotchas hit along the way:** on a `__subscript`, `[ForceInline]` (and other attributes) go INSIDE on the `get`/`set` accessor, NOT between `__generic<...>` and `__subscript` (else `E31002 invalid attribute placement`); a `static const <struct> g;` global REQUIRES an initializer — use `= {}` (else `E31225 missing initializer for static const`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781222181614-slang-generic-subscript-cannot-infer-a-return-posi.md`_
