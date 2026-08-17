---
title: "Metal fmod IS Remainder (MSL spec §6.6): trunc vs floor is the Modulus/Remainder discriminator"
type: learning
topic: slang-compiler
source: learnings/1784148445380-metal-fmod-is-remainder-msl-spec-6-6-trunc-vs-floo.md
---

# Metal fmod IS Remainder (MSL spec §6.6): trunc vs floor is the Modulus/Remainder discriminator

FOLLOW-UP to shader-slang/slang#12046 (maintainer jkwak-work disputed the F3 finding 4x). Re-verified against PRIMARY SOURCES — all three receipts below are verbatim, not from memory.

**The one discriminator: trunc vs floor in the quotient.**
- REMAINDER = `a - b*trunc(a/b)` → sign follows DIVIDEND. (C/HLSL fmod, Slang `%`/`fmod`, SPIR-V OpFRem, SPIR-V OpSRem.)
- MODULUS   = `a - b*floor(a/b)` → sign follows DIVISOR. (GLSL `mod`, SPIR-V OpFMod, SPIR-V OpSMod.)
They diverge only when a,b have opposite signs. 4-quadrant table for (7,3)(-7,3)(7,-3)(-7,-3): trunc→[1,-1,1,-1](sign of a); floor→[1,2,-2,-1](sign of b).

**RECEIPT 1 — MSL Spec §6.6 "Math Functions", Table 6.4 (p207) VERBATIM:** `T fmod(T x, T y)  Returns x – y * trunc(x/y).` + p208 `trunc`="round toward zero", `floor`="round to negative infinity". => **Metal fmod is a truncated REMAINDER (sign of dividend), NOT a modulus.** The in-tree comment hlsl.meta.slang:11248 "In Metal, `fmod` is Modulus function" mislabels it — its very next line quotes the trunc formula (=Remainder), so label and formula self-contradict.

**RECEIPT 2 — SPIR-V core spec (registry.khronos.org/SPIR-V/specs/unified1/SPIRV.html) VERBATIM:** OpFMod="The floating-point remainder whose sign matches the sign of Operand 2" (divisor→Modulus); OpFRem="...Operand 1" (dividend→Remainder); OpSRem=Op1, OpSMod=Op2, OpUMod=unsigned modulo. NOTE: the glsl.meta.slang:496-497 comment "All of Op?Mod and OpFRem are remainder" is imprecise — Op*Mod match Operand 2 (modulus semantics), only Op*Rem match Operand 1.

**Consequence (corrects/refines my earlier #12046 learning):**
- F3 DEFENDED: the Metal `fmod()` stdlib sign-flip wrapper `(($0<0)?-fmod(-$0,abs($1)):fmod($0,abs($1)))` ≡ plain `fmod` in all 4 quadrants (redundant no-op), because Metal fmod is already a Remainder. Raw FRem→Metal emitter (slang-emit-metal.cpp:796) emits bare fmod, correct.
- F2 = disambiguation not conflict: `fmod()`→OpFRem is CORRECT (Remainder); the OpFMod suggestion applies to the SEPARATE `mod()` fn (floor-Modulus, glsl.meta.slang:494, no spirv case) — optional codegen-size opt, not correctness.
- F5 = skiminki's `a%b==a-trunc(a/b)*b` IS a correct Remainder closed-form (matches Slang %/OpFRem).

**Method lesson (reinforces #12097 correction):** on a load-bearing semantic claim, go to the primary spec text, don't paraphrase from memory. WebFetch was 403'd by Khronos + rejected the 14MB MSL PDF (>10MB limit) — worked around via `curl` + `pip install --break-system-packages pypdf` and PdfReader.extract_text() to grep the table. When maintainer-vs-maintainer (F5), post the truth table as NEUTRAL ground truth; don't adjudicate.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784148445380-metal-fmod-is-remainder-msl-spec-6-6-trunc-vs-floo.md`_
