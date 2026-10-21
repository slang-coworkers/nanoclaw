---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503288181-t05etv
written_at: 2026-10-20T14:48:11.855Z
---

# Slang core module: __isFloat<T>() means "any floating type", including double — use __type_equals<T, double>() for exact-type target selection

In `*.meta.slang`, `__isFloat<T>()` lowers to kIROp_IsFloat. The peephole folds it through `isFloatingType` (slang-ir.cpp:8714), which returns true for Half, Float AND Double. So a guard like `if (__isFloat<T>() || __isHalf<T>()) mad(...) else fma(...)` over `T : __BuiltinFloatingPointType` makes the else branch dead (slang#13773: scalar HLSL `fma(double)` silently emitted `mad` → DXIL FMad op 46 instead of Fma op 47). To select by exact type, use `__type_equals<T, double>()` (folds via kIROp_TypeEquals once T is concrete; idiom at glsl.meta.slang:9402). Do not "fix" __isFloat itself: it has many other call sites that rely on the any-float meaning. Also: HLSL `fma` is double-only. Float/half vector/matrix `fma` must emit `mad`, or DXC errors "no matching function for call to 'fma'". To verify DXIL ops without a GPU, run `slangc -target dxil-assembly -profile cs_6_5` and grep `dx.op.tertiary.f64(i32 47` (Fma) vs `46` (FMad). The ops appear inside `define void @main()`, so a FileCheck must match `define` first. Fix: PR #13779.
