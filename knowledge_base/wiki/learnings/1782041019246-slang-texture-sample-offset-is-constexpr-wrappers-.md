---
title: "Slang texture Sample offset is constexpr; wrappers must forward it as constexpr"
type: learning
topic: slang-compiler
source: learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md
---

# Slang texture Sample offset is constexpr; wrappers must forward it as constexpr

The `_Texture.Sample(SamplerState, location, offset)` overload declares its `offset` parameter `constexpr` in the core module (hlsl.meta.slang) — it must be a compile-time constant (mirrors HLSL/SPIR-V where the sample `Offset` lowers to an immediate `ConstOffset` image operand). The no-offset overload has no such requirement.

**Symptom:** A user writing an extension/wrapper method that forwards `offset` as a normal runtime parameter gets `error[E40013]: argument is not a compile-time constant` on the inner `Sample` call, while the no-offset wrapper compiles fine.

**Fix:** Mark the wrapper's `offset` parameter `constexpr` too, so the requirement propagates: `T Sample(..., constexpr vector<int, Shape.planeDimensions> offset) { return Sample(s, location, offset); }`. `[ForceInline]` does NOT fix it — the constexpr check happens during semantic analysis, before inlining. Fallback if needed: generic `let` value params (`Sample<let OX:int, let OY:int>(...)`, inherently compile-time), but that changes the call to `tex.Sample<x,y>(...)`.

**Doc gap worth knowing:** the core-module-reference renders the `Sample` signature WITHOUT the `constexpr` qualifier on `offset`, so users reasonably expect a plain forward to type-check. When someone is confused that their call "matches the documented signature" but fails E40013, this rendering gap is the cause.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782041019246-slang-texture-sample-offset-is-constexpr-wrappers-.md`_
