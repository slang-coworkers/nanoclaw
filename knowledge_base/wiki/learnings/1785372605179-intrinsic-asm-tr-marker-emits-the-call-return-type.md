---
title: "intrinsic-asm $TR marker emits the call return type (fixes tex2Dgather element-vs-4-vector)"
type: learning
topic: slang-compiler
source: learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md
---

# intrinsic-asm $TR marker emits the call return type (fixes tex2Dgather element-vs-4-vector)

**Context:** shader-slang/slang#12276 — `Texture2D<float>.Gather` on CUDA/PTX emits `tex2Dgather<float>` and assigns its scalar result into the `float4` promised by `Gather`'s `vector<T.Element,4>` signature → NVRTC "no suitable constructor from float to float4". Root: `source/slang/hlsl.meta.slang` CUDA intrinsic `tex2Dgather<$T0>` (lines ~4374 & ~4423).

**Key reusable fact — `__intrinsic_asm` marker `$TR`:** In `source/slang/slang-intrinsic-expand.cpp`, `IntrinsicExpandContext::_emitSpecial()`, the `'T'` case handles both `$T<n>` and `$TR`:
- `$T0`/`$T1`... = the *type of operand n* (and if that operand is an `IRTextureType`, it is unwrapped to its **element type** via `getElementType()` — this is exactly the bug: for a texture operand `$T0` gives the texel/element type, not the 4-vector).
- `$TR` = `m_callInst->getDataType()` = the **call's RETURN type**. Precedent already in the tree: `case llvm: __intrinsic_asm "%result = bitcast $0 to $TR";` (hlsl.meta.slang:8034).

So when an intrinsic string needs the *result* type spelled (not an operand's type), use `$TR`. Fix for #12276 = `tex2Dgather<$T0>` → `tex2Dgather<$TR>`.

**Verification-by-construction trick:** the `Texture2D<float4>` control already emits `tex2Dgather<float4>` and compiles (→ PTX `tld4`). That proves the correct template arg is the 4-component result type; `$TR` produces exactly `vector<T.Element,4>` for every element type. Also: this repro is **compile-only** — NVRTC rejects the generated source, so `slangc -target ptx` (or `-target cuda` + grep the emitted `tex2Dgather<...>`) reproduces it with **no GPU**.

**Full marker list** (all in `_emitSpecial`, case-per-char): `$0..$9` operand; `$G<n>` generic arg; `$T<n>` operand type (texture→element); `$TR` return type; `$S<n>` operand scalar type; `$N<n>` vector elem count; `$V<n>` pad-to-4-vector; `$P` CUDA/C++ type prefix; `$*<n>` all args from n; `$!<n>` literal w/o cast; `$[n]` intrinsic operand by position; plus `$p $C $E $c $z $w0b/$w0e`.

**Rebuild reminder:** editing `hlsl.meta.slang` requires `cmake -E touch source/slang/hlsl.meta.slang` → `--target generate_core_module_headers` → `--target slangc` (stale bootstrap embeds old source otherwise).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785372605179-intrinsic-asm-tr-marker-emits-the-call-return-type.md`_
