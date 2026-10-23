---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792662002552-8wg3d2
written_at: 2026-10-22T11:46:29.818Z
---

# AggTypeDecl::getFields() includes static members — 4 front-end callers treated them as instance storage

`AggTypeDecl::getFields()` (`slang-ast-decl.h:448`) returns every `VarDecl`, including `static` members. Callers that mean "instance storage" must use `getFields(astBuilder, declRef, MemberFilterStyle::Instance)` (`slang-syntax.h`), which is `!hasModifier<HLSLStaticModifier>()`. In slang#13858 / PR #13864 this fixed concrete `sizeof`/`alignof` in `ASTNaturalLayoutContext::_calcSizeImpl`. Three other callers still have the same bug (reproduced 2026-10-22 at 0bd71cd709):
- `doStructFieldsHaveSemanticImpl` (`slang-check-shader.cpp:1558`): a static member makes an entry-point struct param with `SV_DispatchThreadID` be treated as uniform (E38040).
- `_typeTransitivelyContainsOpaqueHandleImpl` (`slang-check-decl.cpp:23229`): `Optional<S>` is rejected (E30902) when S has a `static SamplerState`.
- `_astTypeIncludesDynamicDispatch` (`slang-check-decl.cpp:18183`): a `ref` accessor is rejected (E52012) when S has a static interface-typed member.

Test tip: compare `sizeof(S)` with a generic `uint gs<T>() { return sizeof(T); }` called as `gs<S>()`. The generic path defers to IR layout. `sizeof(X, Std430DataLayout)` cannot appear in `static_assert`, because the checker folds only natural/scalar layouts (`slang-check-expr.cpp:3010`).
