---
title: "Generic (T)float-literal cast floors to 0 — IArithmetic lacks __init(float)"
type: learning
topic: slang-compiler
source: learnings/1785559222590-generic-t-float-literal-cast-floors-to-0-iarithmet.md
---

# Generic (T)float-literal cast floors to 0 — IArithmetic lacks __init(float)

**slang#12311**: `T f<T:IArithmetic>() { return (T)0.25; }` returns 0.0 (not 0.25) when T=float, while non-generic `(float)0.25` is correct.

**Root cause (front-end, not emit/specialization):** `IArithmetic` (source/slang/core.meta.slang:140) declares only `__init(int val)` (:171) and `__init(This)` (:174) — it has NO `__init(float)`. IFloat adds `__init(float)` (:308); IInteger adds `__init(int)/__init(int64_t)` (:251). So when the checker coerces a float literal to a value of a generic type parameter constrained by `IArithmetic`, the ONLY visible constructor is `__init(int)` → the literal is implicitly converted float→int (0.25 floored to 0) at *generic-check time* (before specialization), emitting `warning E30081: implicit conversion from 'float' to 'int'`. That folded `0` is baked into the generalized IR and re-widened to T at specialization, so the value is destroyed before the backend runs. **Specialization/emit are victims — don't band-aid there.**

Coercion path: visitTypeCastExpr slang-check-expr.cpp:7411 → _coerce slang-check-conversion.cpp:1701 → AddTypeOverloadCandidates :2634 → lookupConstructorsInType slang-check-overload.cpp:3008/3049; E30081 emitted at slang-check-conversion.cpp:2866.

**Diagnostic tell:** the E30081 warning always names `int` as the conversion target — even for `oneQuarter<int>()` — because the checker resolves the target to `int` regardless of the eventual instantiation type. Bug fires for `(T)0.25`, `(T)0.25f`, AND `T(0.25)` (constructor form) — so it is NOT a C-cast-syntax bug; it's the constrained-generic literal-conversion path.

**Fix fork (design decision, not unilateral):** (A) add `__init(float)` to IArithmetic — symmetric with IFloat/IInteger, but adds a new REQUIREMENT to a public core-module interface → likely LANGUAGE-BREAKING for user-defined conformers; (B) make the checker defer the literal conversion for a constrained generic type param to specialization — non-breaking but delicate. A vs B / breaking-vs-non-breaking = maintainer call.

**Repro without GPU:** `slangi /tmp/t.slang` with a `void main(){ printf("%f %f", (float)0.25, oneQuarter<float>()); }` prints `0.250000 0.000000`. Also visible in emitted CUDA/C++/GLSL/SPIR-V — the generic body constant-folds to `0`/`0.0f`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785559222590-generic-t-float-literal-cast-floors-to-0-iarithmet.md`_
