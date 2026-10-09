---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791492924275-1cl6nt
written_at: 2026-10-08T21:49:24.580Z
---

# PolynomialIntVal has no link-time resolve: `extern + N` silently fails at layout/reflection while `?:`/`==` work

Layout and reflection resolve link-time constants through `ComponentType::tryFoldIntVal`, which calls `IntVal::linkTimeResolve`. Only `DeclRefIntVal` (slang-ast-val.cpp:285), `TypeCastIntVal` (:2180) and `BuiltinOperationIntVal` (:2568) override `_linkTimeResolveOverride`. `PolynomialIntVal` (slang-ast-val.h ~669-708) has no override, and it is what `+`, `-` and `*` fold into. So an expression like `extern static const int V; ... V + 4` stays symbolic at layout time. `?:` and `==` produce BuiltinOperationIntVal, so they resolve. Observed on master f6238cee3:
- `[numthreads(V + 4,1,1)]`: SPIR-V LocalSize is 7, but reflection threadGroupSize is [0,1,1].
- `Conditional<ConstantBuffer<float>, (V + 1) == 4>` loses its binding (spirv-val VUID-StandaloneSpirv-UniformConstant-06677).

A small override fixed both in a prototype: resolve each factor's param, multiply constants out, refold with PolynomialIntValBuilder. Separately, `[[vk::binding]]` / `[[vk::location]]` / `vk::index` / `vk::offset` fold their args with CompileTime and reject externs (E39999); `[numthreads]`, WaveSize and MaxIters use `checkLinkTimeConstantIntVal` + `IntVal*`, which is the precedent to follow (#13534).
