---
title: "slang #11730 — builtin vector is a DeclRefType&lt;StructDecl&gt;; init-list arg-coercion bug = if(outExpr) guard on createInvokeExprForExplicitCtor"
type: learning
topic: slang-compiler
source: learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md
---

# slang #11730 — builtin vector is a DeclRefType&lt;StructDecl&gt;; init-list arg-coercion bug = if(outExpr) guard on createInvokeExprForExplicitCtor

## Bug
`{a, b}` flattening a `float2`+`float` into a `float3` compiles in a variable declaration / `return` / assignment, but FAILS (E30019 "expected float, got vector<float,2>") when passed directly as a function-call argument: `void foo(float3 c){} ... foo({a,b});`. All-scalar args (`foo({b,b,b})`) work; `foo(float3(a,b))` explicit ctor works.

## PROVEN root cause (fixer stderr-instrumented at HEAD 51959e21ff)
`vector<float,3>` **IS a `DeclRefType<StructDecl>`** (the core-module `vector` struct) with explicit constructors like `vector(float2,float)`. So initializer-list→vector coercion succeeds via `createInvokeExprForExplicitCtor` — the FIRST branch of `_coerceInitializerList` (source/slang/slang-check-conversion.cpp). Its success `return true` is **nested inside `if (outExpr)`** (~:825-829 at HEAD). When overload resolution's `canCoerce` probes candidate viability it passes `outExpr == nullptr` → the helper returns FALSE even though `float3(a,b)` type-checks cleanly → `canCoerce` reports `{a,b}→float3` impossible → the `foo(float3)` candidate is rejected → fallback legacy element-reader runs `_coerce(float, float2)` (float2→float is not implicit) → E30019. All-scalar works because the legacy reader succeeds element-wise even on the null-outExpr probe.
Fix (+9/−3, producer-layer): un-nest the `return true` so viability is reported independent of `outExpr`, matching the already-correct siblings `createInvokeExprForSynthesizedCtor` (~:930-935) and `createCtorInvokeExprForAbstractType` (~:745-747). The just-trying probe must agree with the for-real coercion. No downstream guard / legacy-reader change.

## Triage lessons (where my triage MODEL was wrong)
1. **Builtin vector/matrix ARE core-module structs** — `isDeclRefTypeOf<StructDecl>(float3)` is TRUE. I wrongly assumed `vector<float,3>` is only a `VectorExpressionType` and therefore ruled out the struct-gated `createInvokeExprForExplicitCtor`, chasing `createCtorInvokeExprForAbstractType` as "the vector path." That helper is NOT it — `_canLookupConstructorsThroughAbstractType` returns true ONLY for generic-type-params / pack-element types, FALSE for vector. Whether a builtin is a `DeclRefType<StructDecl>` decides which coercion branch applies — verify, don't assume.
2. **I spotted the real mechanism but mis-attributed it.** I correctly flagged the `if(outExpr)` check-only(`canCoerce`)-vs-for-real divergence as the leading hypothesis, but pinned it on the wrong helper. When you spot such a guard, audit ALL sibling helpers (`createInvokeExprForExplicitCtor` / `…SynthesizedCtor` / `…ForAbstractType`) and confirm which is actually on the path — cheap stderr instrumentation settles it; source-reading alone misled me.

## What went RIGHT (reinforces existing discipline)
The PUBLIC issue verdict comment stayed at the proven mechanism level ("flattening works at most sites via a constructor; the argument path falls back to legacy per-element coercion → E30019") and did NOT name a specific helper. The specific-helper claim lived as a clearly-LABELED hypothesis in the internal memo/handoff only. So the proven correction (different helper) required NO public correction. Keep specific-function root-cause claims as labeled hypotheses; keep public verdicts at the proven-mechanism level.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782733705823-slang-11730-builtin-vector-is-a-declreftype-lt-str.md`_
