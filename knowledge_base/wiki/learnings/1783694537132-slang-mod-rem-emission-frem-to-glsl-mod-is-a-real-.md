---
title: "slang mod/rem emission: FRem-to-GLSL-mod is a real bug; Metal fmod sign-flip is redundant"
type: learning
topic: slang-compiler
source: learnings/1783694537132-slang-mod-rem-emission-frem-to-glsl-mod-is-a-real-.md
---

# slang mod/rem emission: FRem-to-GLSL-mod is a real bug; Metal fmod sign-flip is redundant

Triage of shader-slang/slang#12046 (modulus/remainder audit). Verified at HEAD 85d79c67 via source + DeepWiki.

**Ground truth.** Slang `%`(float) and `fmod()` are both truncation remainder (sign follows dividend), both lower to IR op `kIROp_FRem`. There is NO `kIROp_FMod` op — GLSL-style `mod()` (floor modulus, `x - y*floor(x/y)`, sign follows divisor) is synthesized arithmetically in glsl.meta.slang, not an IR op. They diverge for negative operands: `-1.5 % 2.0 = -1.5` (rem) vs `mod(-1.5,2.0) = 0.5` (floormod).

**Real bug (F1):** GLSL *text* emitter maps `kIROp_FRem` → GLSL `mod()` builtin (slang-emit-glsl.cpp:2601, with an existing TODO). That's floor modulus — wrong sign for negatives. This makes `a % b` disagree with `fmod(a,b)` on GLSL even though the language defines them identically: the stdlib `fmod()` GLSL case (hlsl.meta.slang:11288) already uses the correct sign-flip workaround `(($0<0)?-mod(-$0,abs($1)):mod($0,abs($1)))`. SPIR-V *direct* is fine (OpFRem at slang-emit-spirv.cpp:859). Fix = mirror the stdlib sign-flip in the emitter FRem case.

**Non-obvious cleanup (F3):** the stdlib `fmod()` Metal case (hlsl.meta.slang:11292) wraps fmod in a sign-flip that is BIT-IDENTICAL to plain `fmod(x,y)` in all 4 sign quadrants — Metal's fmod is already C-style truncation remainder, NOT a modulus. The in-tree comment at hlsl.meta.slang:11248 ("In Metal, `fmod` is Modulus function") is FACTUALLY WRONG and is the likely origin of the redundant workaround. The raw FRem→Metal emitter path (slang-emit-metal.cpp:796) already emits plain fmod correctly. So "simplify Metal to plain fmod" (the issue's Metal lead) is correct.

**Optimality (F2):** stdlib `mod()` has no spirv case → falls to 4-op arithmetic instead of single `OpFMod`. Adding `case spirv:` OpFMod is the answer to the issue's SPIR-V lead, but it's a codegen-quality/maintainer call.

Meta: the recall Explore subagent failed with a haiku model-access 403 ("subscription still being processed") — did recall directly via grep instead. Watch for this if haiku is gated.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783694537132-slang-mod-rem-emission-frem-to-glsl-mod-is-a-real-.md`_
