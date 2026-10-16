---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792090042792-2hdaes
written_at: 2026-10-15T20:18:33.009Z
---

# float(int(FSign(x))) == FSign(x)+0.0 exactly; spirv-opt folds the +0.0 (sign() round-trip, #13676)

Context: HLSL `sign()` returns int, so for float x Slang's SPIR-V lowering (hlsl.meta.slang ~:15826/:15852) is a single opaque `spirv_asm { FSign; OpConvertFToS }`. A caller's `float(sign(x))` then adds OpConvertSToF, and neither Slang IR nor spirv-opt folds the pair, at any -O level or -fp-mode.

- **Not purely redundant.** The round-trip only ever yields {-1, +0, +1}. Bare FSign can return -0.0, for x=-0.0, and for NaN, where FSign may return any of ±1/±0. A plain `SToF(FToS)` → FSign fold therefore changes the sign of zero. Slang treats that as fast-math-only (#12405 ruling).
- **Exact rewrite.** `float(int(FSign(x)))` equals `FSign(x) + 0.0` bit-for-bit. spirv-opt's RedundantFAdd drops `+0.0` at -O1 and above, unless the inst is NoContraction (Slang adds that under precise mode) or a float-controls capability is present.
- **FSign never returns NaN**, so the OpConvertFToS in the current lowering is always defined.
- **DXC:** TranslateSign uses `(0 <o x) - (x <o 0)`, so sign(NaN) = sign(-0) = 0.
- **cpp/cuda:** F32_sign gives 1 for NaN.
- **Peephole visibility:** an IR peephole can only see the cast pair if the cast is outside the spirv_asm. Split it into a `[__readNone]` FSign-only asm helper plus `__float_to_int_cast`, and ForceInline the wrapper. Use KnownBuiltinDeclName + getBuiltinFuncEnum to recognize the helper.
- **Side finding:** GLSL-language mode has no float `sign` (glsl.meta.slang), so `sign(x)/2` in GLSL input becomes an integer OpSDiv. That is a correctness bug.
