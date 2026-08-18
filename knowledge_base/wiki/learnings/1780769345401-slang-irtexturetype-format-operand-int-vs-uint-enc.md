---
title: "Slang IRTextureType format-operand: int vs uint encoding + only-fresh-producer site (slang#11503)"
type: learning
topic: slang-compiler
source: learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md
---

# Slang IRTextureType format-operand: int vs uint encoding + only-fresh-producer site (slang#11503)

## shader-slang/slang#11503 — texture format-operand schema drift (PR #11504, draft, 3-reviewer APPROVE)

**The fix:** one token at `source/slang/slang-ir-resolve-texture-format.cpp:54` — `builder.getUIntType()` → `builder.getIntType()` for the synthesized `IRTextureType` `format` operand. Aligns with the schema `hlsl.meta.slang:832 let format:int`.

### Non-obvious facts worth keeping

1. **`resolveTextureFormatForParameter` (`:54`) is the ONLY in-tree producer that synthesizes a *fresh* `format` constant.** Every other `getTextureType(...)` rebuild site forwards the existing operand via `textureType->getFormatInst()` — they do not construct a new format constant. So format-operand encoding drift can only originate at this one site; an audit of "all texture-type producers" collapses to exactly this line.

2. **The true `format`-operand sibling that already uses `getIntType()` is `addFormatDecoration` at `slang-ir-insts.h:5134`** — not `slang-ir-util.cpp:3157` / `slang-emit-spirv.cpp:10917`. Those two build the *`isCombined`* operand with `getIntType()`, not `format`. If you cite "sibling producers use getIntType()" in a PR body, lead with `addFormatDecoration` (Reviewer A flagged the isCombined cites as imprecise). The schema-driven frontend lowering also produces Int-typed format operands.

3. **Why the type token is load-bearing (and why this is foreclosure-only):** the IR-builder's hoistable-constant cache keys on `(value, type)` (`IRBuilder::getIntValue` keying at `slang-ir.cpp:2367-2402`; `IRConstant::equal` at `slang-ir.cpp:2201`). So `(uint, N)` and `(int, N)` are *distinct* cache keys → a uint-typed format constant would block `getTextureType` from de-duplicating the synthesized texture type against the schema-built (int-typed) one. **Latent today** because the producer guards on `format != ImageFormat::unknown` (never emits `0`) and no other producer in master synthesizes an `Unknown` constant — so two encodings never both produce a constant for the same value. Activates when #11499's `!hasFormat()` `int 0` fallbacks land, or if that guard loosens.

4. **All format-operand readers are type-token-agnostic** — `getSpvImageFormat` (`slang-emit-spirv.cpp`), `getImageFormat` (`slang-emit-wgsl.cpp`), GLSL via `IRFormatDecoration`, and the `(ImageFormat)getFormat()` casts all extract the integer value via `getIntVal()` and never compare the IR type token. `ImageFormat` values are non-negative, `int32`-fitting → observation-equivalent at every backend, hence `pr: non-breaking`.

### Test pattern that works for IR-pass producer fixes
`//TEST:SIMPLE(filecheck=IR): -target spirv-asm -entry computeMain -stage compute -dump-ir-after <passName>` (here `resolveTextureFormat`). For the texture format operand: trigger synthesis with `[format("r16f")] RWTexture2D<float>` (non-`unknown` format ≠ the type-token format), then FileCheck the trailing operand: `IR: TextureType({{.*}}, {{[0-9]+}} : Int){{.*}}= global_param`. **Scope the `IR-NOT` guard to the format-operand position** (`, {{[0-9]+}} : UInt){{.*}}= global_param`), mirroring the positive anchor, rather than forbidding `UInt` anywhere in any `TextureType(...)` — otherwise an unrelated operand legitimately becoming `UInt` later would fail the test for a reason unrelated to the regression it pins (Reviewer C clarity nit FG002).

### Env note
The fixer container lacks clang-format/gersemi/shfmt on PATH; install per-session with `pip install --user --break-system-packages clang-format==17.0.6 gersemi==0.21.0` + `curl shfmt → ~/.local/bin`, then `export PATH="$HOME/.local/bin:$PATH"` before `./extras/formatting.sh`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780769345401-slang-irtexturetype-format-operand-int-vs-uint-enc.md`_
