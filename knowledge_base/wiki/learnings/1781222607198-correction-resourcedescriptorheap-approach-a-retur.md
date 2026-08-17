---
title: "CORRECTION: ResourceDescriptorHeap Approach A (return-position generic subscript) is a dead end — E39999"
type: learning
topic: slang-compiler
source: learnings/1781222607198-correction-resourcedescriptorheap-approach-a-retur.md
---

# CORRECTION: ResourceDescriptorHeap Approach A (return-position generic subscript) is a dead end — E39999

Corrects my earlier learning "ResourceDescriptorHeap/SamplerDescriptorHeap input syntax is front-end-only — backend already exists", which recommended **Approach A** (declare builtin globals whose generic `__subscript(uint) → DescriptorHandle<T>`, with `T` solved from the assignment target). A slang-fixer feasibility spike on slang#11568 (@ HEAD 45c04170f) proved Approach A is **NOT expressible declaratively in meta.slang with the current checker**:

- The two builtin globals + generic `__subscript(uint) -> DescriptorHandle<T>` compile cleanly INTO the core module.
- But the use site `Texture2D t = ResourceDescriptorHeap[i];` fails type-check: `error[E39999]: could not specialize generic for arguments of type (uint)`.
- Root cause: Slang's overload resolution solves a generic subscript's type parameter from the **index arguments only**; it does NOT thread the assignment/coercion target type into subscript specialization. A type param appearing **solely in return position** cannot be inferred. (C++ would likewise reject return-only template deduction.)

So: the backend (DescriptorHandle<T> lowering → HLSL SM6.6 + SPV_EXT_descriptor_heap) is still entirely reusable, but you cannot reach it via a return-position-only generic subscript. Viable paths (both were handed to maintainer @jkwak-work as design decisions, not auto-built, under the HARD design gate):
- **A2 / proxy (recommended):** `__subscript` returns a concrete, non-generic proxy type carrying the uint index; add a per-resource-type implicit conversion `T.__init(proxy)` hooked into the existing per-type generation loop (hlsl.meta.slang ~26996-27061), body builds `DescriptorHandle<T>(uint2(idx,0))` and rides `getDescriptorFromHandle`. `T` is then known from the conversion constructor's owner — no return-only inference. Cost: new surface type + conversions across generation sites; still single-source-of-truth.
- **C / checker change:** teach the checker to use the expected/target type when specializing a subscript's return-position generic (enables pure Approach A). Bigger, riskier type-system change.

General reusable insight beyond this issue: a meta.slang builtin whose generic param appears ONLY in return position is unusable as-is — bind the generic from an argument, or use a non-generic proxy + per-target-type `__init` conversion to recover the target type from the conversion owner.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781222607198-correction-resourcedescriptorheap-approach-a-retur.md`_
