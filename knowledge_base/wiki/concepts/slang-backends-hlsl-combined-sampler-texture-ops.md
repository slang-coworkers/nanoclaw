---
title: "Combined-sampler texture-only ops on HLSL, Metal and WGSL: the injected sampler operand, `$q`, and member-form intrinsics"
type: concept
group: slang-backends
tags: [hlsl, metal, wgsl, combined-sampler, Sampler2D, lowerCombinedTextureSamplers, GetDimensions, Load, subscript, intrinsic-asm, __getTexture, dxc, slang]
source_count: 2
---

# Combined-sampler texture-only ops on HLSL, Metal and WGSL: the injected sampler operand, `$q`, and member-form intrinsics

A combined texture-sampler (`Sampler2D<T>` and its family) is native on SPIR-V (`OpTypeSampledImage`) and GLSL (`sampler2D`), and CUDA keeps it as one `CUtexObject`. On HLSL, Metal, WGSL and CPU, `lowerCombinedTextureSamplers` splits it into a `{texture, sampler}` pair, and every call on it gains the sampler as operand 1. An op that uses the sampler (`Sample`) is fine. A *texture-only* op (`GetDimensions`, `Load`, the subscript) is not, because its intrinsic string was written for a receiver with no sampler. This page records how that miscompiles on each target and what the fixes cover. GLSL combined-sampler emit shape (parenthesized arguments) is on [[wiki/concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md]]; the broader WGSL/Metal backend is on [[wiki/concepts/slang-backends-wgsl-metal.md]].

## TL;DR

- **`lowerCombinedTextureSamplers` (HLSL/Metal/WGSL/CPU) turns a combined `Sampler2D` into `{texture, sampler}` and injects the sampler as call operand 1.** A texture-only op whose intrinsic string is numbered without that sampler then reads the sampler where it expects its first argument.
- **SPIR-V, GLSL and CUDA are not affected**: SPIR-V and GLSL have native combined types, and CUDA is not in the lowering set.
- **`GetDimensions` on Metal and WGSL was fixed by PR #11816 (#11669)** with the `$q` intrinsic marker, which makes `$N` (N ≥ 1) skip an operand whose type is a sampler. Before it, width was written through the sampler and the last output was never written.
- **`$q` cannot reach HLSL.** HLSL's `Load`, subscript and `GetDimensions` are bare member intrinsics (`__intrinsic_asm ".Load"` and similar) with no `isCombined` branch, so the sampler leaks: `tex.Load(sampler, coord)`, `tex[sampler] = coord`, `tex.GetDimensions(sampler, ...)`. DXC rejects all of them (#13737, shared root with #10522).
- **`Load` and the subscript also leak on Metal and WGSL**: Metal `.read` and WGSL `textureLoad` take the sampler as the coordinate.
- **`Sample` works because the meta code forwards it through `__getTexture()`.** The user workaround, and the endorsed fix direction, is the same rewrite: `s.__getTexture().Load(...)`, `s.__getTexture().GetDimensions(...)`.
- **When auditing a combined-sampler bug, check every texture-only op** (all `Load` overloads, multisample `Load`, the subscript, both `GetDimensions` overloads) on every target in the lowering set, not just the reported one.
- **`tests/metal/texture-sampler-less.slang` runs `-target hlsl` but only checks `void computeMain(`**, so it passes while every one of these HLSL failures is present.

## The injected sampler operand and the `$q` marker (#11669, PR #11816)

`Sampler2D<T>.GetDimensions(out0, out1)` used to miscompile on WGSL (#11669) and Metal: the width was written to the sampler variable, the height to the first output, and the second output was never written. The cause is the operand list after lowering. `lowerCombinedTextureSamplers` makes the operands `[texture, sampler, out0, out1]`, but the `GetDimensions` strings, generated in C++ by `TextureTypeInfo::writeGetDimensionFunctions()` (`slang-core-module-textures.cpp`), address operands by position (`$0` = receiver, `$1`/`$2` = outputs). The existing compensation, `m_argIndexOffset -= 1` under the `$p` marker, handles the opposite case (a string numbered *with* a sampler slot that is absent), and these strings never used it. The analysis at the time endorsed a source or early-IR rewrite to `combinedSampler.__getTexture().GetDimensions(...)`, which would fix every target at once ([Combined-sampler GetDimensions off-by-one — shared root with HLSL #10522](../learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md)).

PR #11816 (commit 0b78add933) fixed it differently, for Metal and WGSL only. It added the `$q` marker (`IntrinsicExpandContext::_emitSpecial`, `slang-intrinsic-expand.cpp`), the mirror of `$p`: when operand 1 has a sampler type, `$N` for N ≥ 1 skips it, and on a plain texture `$q` is a no-op. The Metal and WGSL `GetDimensions` strings now start with `$q`. CUDA was never affected, because its combined `Sampler2D` stays a single `CUtexObject` and is not lowered.

## HLSL, and `Load`/subscript everywhere, still leak the sampler (#13737)

`$q` lives inside a `$N` string, so it cannot help an intrinsic that has no `$N` string. On HLSL, `Load` (all overloads, including multisample), `operator[]` and `GetDimensions` are bare member-form intrinsics: `hlsl.meta.slang` (around lines 5105 and 5355) has `case hlsl: __intrinsic_asm ".Load";`, and `writeFuncBody` in `slang-core-module-textures.cpp` (`:81-83`) writes `case cpp: case hlsl: __intrinsic_asm ".<name>";`. Neither has an `isCombined` branch. A member-form intrinsic prints every remaining operand as an argument, so after lowering the injected sampler becomes the first argument: HLSL gets `tex.Load(sampler, coord)`, `tex.GetDimensions(sampler, ...)`, and the subscript prints as `tex[sampler] = coord`. DXC rejects all three. On Metal and WGSL, `GetDimensions` is fixed, but `Load` and the subscript still leak: WGSL `textureLoad` and Metal `.read` take the sampler as their coordinate. `Sample` works on every target only because its meta code forwards through `__getTexture()`, and that is also the user workaround: write `s.__getTexture().Load(...)` or `s.__getTexture().GetDimensions(...)`.

Two audit lessons come from this. First, a combined-sampler bug report names one op, but the fault is in the lowering contract, so check every texture-only op (each `Load` overload, multisample `Load`, the subscript, both `GetDimensions` overloads) on every target in the lowering set. Second, an existing test can hide the bug: `tests/metal/texture-sampler-less.slang` has a `-target hlsl` directive, but its only HLSL check is `void computeMain(`, which matches broken output ([Combined-sampler texture-only ops on HLSL: Load/subscript/GetDimensions all leak the sampler (#13737)](../learnings/1792252557823-combined-sampler-texture-only-ops-on-hlsl-load-sub.md)).

Status on 2026-10-19: a maintainer closed #13737 on 2026-10-18 with no linked merged commit. Draft PR #13741, "Skip the combined sampler in texture-only HLSL/Metal/WGSL texture ops (#13737, #10522)", was still open and unmerged, so master at 60a7c8c88 still has the member-form HLSL intrinsics described above. Re-check at HEAD before relying on either the bug or the fix.

**Source learnings (2):**
- [Combined-sampler GetDimensions off-by-one (WGSL/Metal/CUDA) — shared root with HLSL #10522](../learnings/1781992589265-combined-sampler-getdimensions-off-by-one-wgsl-met.md) — positional `$N` strings vs the injected sampler; endorsed `__getTexture()` rewrite (later fixed for Metal/WGSL by `$q`, PR #11816)
- [Combined-sampler texture-only ops on HLSL: Load/subscript/GetDimensions all leak the sampler (#13737)](../learnings/1792252557823-combined-sampler-texture-only-ops-on-hlsl-load-sub.md) — HLSL member-form intrinsics have no `isCombined` branch and `$q` cannot reach them; Metal/WGSL `Load`/subscript leak too; `texture-sampler-less.slang` masks it

_Catalog: [[wiki/index.md]]_
