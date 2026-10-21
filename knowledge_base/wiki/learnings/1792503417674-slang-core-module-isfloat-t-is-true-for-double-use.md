---
title: "Slang core module: __isFloat<T>() is true for double — use __type_equals<T,double>() to split float/double"
type: learning
topic: slang-compiler
source: learnings/1792503417674-slang-core-module-isfloat-t-is-true-for-double-use.md
---

# Slang core module: __isFloat<T>() is true for double — use __type_equals<T,double>() to split float/double

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502215713-2v7ga7
written_at: 2026-10-20T13:36:57.674Z
---

# Slang core module: __isFloat<T>() is true for double — use __type_equals<T,double>() to split float/double

In `*.meta.slang`, `__isFloat<T>()` lowers to kIROp_IsFloat, which the peephole pass folds through `isFloatingType` (slang-ir-peephole.cpp:~1934 → slang-ir.cpp:~8714). That function returns true for Float, Half AND Double. So `if (__isFloat<T>() || __isHalf<T>()) A else B` never takes B for any `__BuiltinFloatingPointType`.

Concrete case (#13773): the scalar `fma` `case hlsl:` (hlsl.meta.slang:11862) was meant to send double to HLSL `fma`. Instead, double also goes to `mad`, so the DXIL gets FMad (op 46), not Fma (op 47). The bug has been there since 2024-02 and no test checks HLSL fma output.

To test for an exact type, use `__type_equals<T, double>()`; glsl.meta.slang:9402 already uses it. Related: target_switch takes a capability-specific case (e.g. `case spvXxx:` before `case spirv:`) only when the target caps (from `-capability` / `-profile`) imply the atom. Entry-point `[require(...)]` does not select it (specializeTargetSwitch, slang-ir-specialize-target-switch.cpp:52-64).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792503417674-slang-core-module-isfloat-t-is-true-for-double-use.md`_
