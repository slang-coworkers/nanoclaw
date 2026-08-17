---
title: "slang init-list→vector: (vec2,vec2) composition ctor splats scalars, diverges from tail-pad path"
type: learning
topic: slang-compiler
source: learnings/1784025263407-slang-init-list-vector-vec2-vec2-composition-ctor-.md
---

# slang init-list→vector: (vec2,vec2) composition ctor splats scalars, diverges from tail-pad path

**Issue:** shader-slang/slang#12093. `int4 v={1,int2(2,3)}` gives `{1,1,2,3}` (scalar `1` splatted to `int2(1,1)`), but `int4 v={1,2,3}` gives `{1,2,3,0}` (tail-pad by 0). Verified on ToT via `build/Debug/bin/slangi` (CPU interpreter — front-end bug, no GPU needed).

**Root cause (reusable insight):** `vector<T,N>` is a core-module `DeclRefType<StructDecl>` with EXPLICIT composition constructors defined in `core.meta.slang:2777-2805` — for `vector<T,4>`: `(T,T,T,T)`, `(vec2,T,T)`, `(T,vec2,T)`, `(T,T,vec2)`, **`(vec2,vec2)`**, `(vec3,T)`, `(T,vec3)`. Crucially there is **NO 3-parameter ctor**.

Initializer-list→vector coercion in `slang-check-conversion.cpp:1378` `_coerceInitializerList` tries **constructor overload resolution FIRST** (`createInvokeExprForExplicitCtor`, :1403), and only falls back to the legacy component-wise reader `_readAggregateValueFromInitializerList` (:998-1053, which fills left-to-right and tail-pads missing components with 0) when **no constructor matches the arg count**.

- `{1,2,3}` (3 args): no 3-arg ctor → ctor resolution fails → legacy path → `{1,2,3,0}`.
- `{1,int2(2,3)}` (2 args): the only applicable 2-param ctor is `(vec2,vec2)`, so scalar `1` implicit-splats to `int2(1,1)` (cost `kConversionCost_ScalarToVector=2`, `slang-ast-support-types.h:172`) → `__makeVector(int2(1,1),int2(2,3))` → `{1,1,2,3}`.

So the number of init-list elements determines whether you hit the ctor-overload path (which can splat scalars to fill a composition ctor) or the legacy tail-pad path — that's the inconsistency. Same "vector is a struct, init-list routes through ctor overload resolution" area as #11730.

**Triage disposition:** design-gated. Reporter (skiminki-nv) is a maintainer asking a *semantics* question; all fixes change compiling behavior (breaking). Parked at triaged, held for maintainer decision — no fixer. Candidate fixes: A) suppress scalar→vector splat when selecting a vector composition ctor from an init-list (smallest, → consistent `{1,2,3,0}`); B) component-count flatten before ctor resolution; C) disallow implicit under-fill entirely.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784025263407-slang-init-list-vector-vec2-vec2-composition-ctor-.md`_
