---
title: "slang #11861 — vk::binding on struct-of-resources entry param: mirror of #11857, same predicate"
type: learning
topic: slang-compiler
source: learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md
---

# slang #11861 — vk::binding on struct-of-resources entry param: mirror of #11857, same predicate

**slang #11861** (regression from #11712, verified at HEAD v2026.12.1-1-g6d355565c, 2026-07-01). Companion to the existing #11857 learning (1782864612564).

Both bugs are the SAME divergence in the vk::binding-on-entry-point diagnostic, opposite polarity:
- DIAGNOSTIC side: `isVkBindingCompatibleEntryPointParameterType` (source/slang/slang-check-shader.cpp:773-798, called in the E38010 loop at :2044-2055) is a PRE-LAYOUT AST-type approximation of "will this consume a descriptor slot?".
- BINDER side (ground truth, POST-LAYOUT): `findVkBindingEntryPointParameterResourceInfo`/`hasSupportedVkBindingOnEntryPointParameter` (source/slang/slang-parameter-binding.cpp:1412-1447) honors vk::binding whenever the param's TYPE LAYOUT has a `DescriptorTableSlot` or `SubElementRegisterSpace`.

#11857 = predicate TOO PERMISSIVE (`PtrType` at :789-790 suppresses E38010 for a `uint*` the binder won't honor → silently ignored). #11861 = predicate TOO NARROW (it does NOT recurse into an aggregate `struct`, so a resource-containing `struct` returns false → E38010 fires even though the binder DID honor it). Fix for #11861: recurse into struct fields (return true if a field transitively consumes a descriptor binding); or the robust fix — decide from the computed type layout (single source of truth), which subsumes #11857. Both issues edit the same function → coordinate.

REPRO NUANCE (cost me time): a resource-bearing struct is only valid as a `uniform` entry-point param, NOT a varying one. The reporter's literal repro (bare `Resources resources`, no `uniform`) fails earlier with E39028 "not a valid varying parameter" — that masks the bug and is correct/pre-existing. Add `uniform`: `[[vk::binding(2,1)]] uniform Resources{Texture2D,SamplerState}` → SPIR-V binds tex@Binding2/Set1, samp@Binding3/Set1 AND spuriously warns E38010. A direct resource param (`[[vk::binding]] Texture2D tex`) is already suppressed by #11712. Regression tests for this class MUST use `uniform`.

LESSON (reinforces 1782864612564): a pre-layout AST predicate that gates "is this modifier honored?" must be a FAITHFUL MIRROR of the post-layout binder — too broad → silent-ignore, too narrow → false warning. Aggregates (structs) are the trap: the binder decomposes them via layout; an AST predicate that only checks the top-level type won't.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782871594193-slang-11861-vk-binding-on-struct-of-resources-entr.md`_
