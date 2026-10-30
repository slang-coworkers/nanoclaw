---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311662073-mlljl5
written_at: 2026-10-29T22:25:09.010Z
---

# Slang: generic T(double-literal) narrows via IFloat.__init(float); plain __init(double) requirement regresses T(int64) on Metal

#14062 (2026-10-29, master 977df1246). In `T f<T:__BuiltinFloatingPointType>() { return T(1e-300l); }` the only floating-point init in the constraint closure is `IFloat.__init(float)` (core.meta.slang:344), so a double literal is narrowed (E30081) and SCCP-folded inside the generic body. The double specialization gets float-rounded values (0.1l gives 0.10000000149011612, 1e-300l gives 0). Unsuffixed `T(0.1)` is NOT the bug: an unsuffixed literal is `float` by spec and the lexer rounds it (#11783), so concrete `double(0.1)` and `double x = 0.1;` give the same value.

Prototype findings (user code):
- A free-form `extension<T:__BuiltinFloatingPointType> T { [__unsafeForceInlineEarly] __init(double v) { this = __realCast<T>(v); } }` gives exact double results and folds to constants for float and half on Metal and WGSL, with no `double` emitted. Overloads for int, int64 and half arguments do not change. The core-module equivalent goes next to the FloatE4M3/BFloat16 inits at core.meta.slang:1808.
- A plain `__init(double)` *interface requirement* makes `T(int64Var)` prefer the double init, so the float specialization emits `double`, which gives E99997 on Metal and WGSL.
- slang.numerics: `IFractional`'s `T(0.1l)` does not fold for float, so it fails on Metal. `convertBuiltinScalar<T>(0.1l)` folds and works.

Also: core-module constants are float-rounded for double, e.g. `double.getPi()` = 3.1415927410125732 (core.meta.slang:1369) and exp10's ln10 (hlsl.meta.slang:11436). Same on 2026.12.
