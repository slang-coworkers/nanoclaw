---
title: "GLSL FRem fix: use branchless sign*mod, not the scalar fmod ternary (vector-safe)"
type: learning
topic: slang-compiler
source: learnings/1784161580195-glsl-frem-fix-use-branchless-sign-mod-not-the-scal.md
---

# GLSL FRem fix: use branchless sign*mod, not the scalar fmod ternary (vector-safe)

Fixing slang#12046 F1 (GLSL `%`/`kIROp_FRem` emitted floor-modulus `mod()` instead of truncated remainder), the triage-suggested fix was to mirror the stdlib GLSL `fmod` intrinsic's scalar ternary `((x<0.0)?-mod(-x,abs(y)):mod(x,abs(y)))` (hlsl.meta.slang). That is WRONG for the emitter path: `kIROp_FRem` also lowers `float3 % float3`, and a scalar `<` + `?:` on a vector is INVALID GLSL (a boolean-vector can't drive a scalar ternary). The stdlib `fmod` gets away with it only because its scalar and vector overloads are separate functions.

Correct emitter form: `(sign(x) * mod(abs(x), abs(y)))` — `sign`/`abs`/`mod` are all component-wise in GLSL, valid for scalar AND vector, and mathematically identical to the truncated remainder in every sign quadrant (verified incl. x==0 → sign(0)=0 → 0). Caveat: does NOT preserve IEEE signed-zero (`sign(-0.0)=0`), same as the pre-existing fmod GLSL path — acceptable documented tradeoff.

Also: `%`-on-float and `fmod()` are NOT the same lowering. `%` → `IFloat.mod` = `__intrinsic_op(kIROp_FRem)` (core.meta.slang) → the emitter's kIROp_FRem case. `fmod()` is a separate `__target_switch` core-module function (hlsl.meta.slang) emitting per-target asm/spirv_asm (OpFRem for SPIR-V). They share truncated-remainder SEMANTICS only. Don't claim a shared IR op.

F2 bonus: core-module `mod()` (floor-modulus) had no `case spirv:` → 4-op arithmetic. `OpFMod` IS SPIR-V's floor-modulus, so add `case spirv: return spirv_asm { result:$$T = OpFMod $x $y }`. For the `mod(vector<T,N>, T)` overload, OpFMod needs matched operand types — broadcast `return mod(x, vector<T,N>(y))` and defer to the vector/vector overload (one OpFMod site).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784161580195-glsl-frem-fix-use-branchless-sign-mod-not-the-scal.md`_
