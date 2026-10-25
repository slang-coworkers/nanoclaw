---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792822114720-gon9vt
written_at: 2026-10-24T12:45:35.161Z
---

# Slang: removeUnusedGenericParam merges types whose witnesses differ; FileCheck -NEXT fails on slang-test HLSL

1) `slang-ir-remove-unused-generic-param.cpp` hoists a struct generic whose parameters are all unused to global scope, so empty specializations like `struct Number<let N:uint> : ICode {}` (Number<0>, Number<1>) become ONE IR type while their witness tables stay distinct. Typeflow then gives `T` a single type with a witness SET. Any code that pairs witnesses by `getConcreteType()` must allow duplicate concrete types (or reject them only when several constraints must be correlated).
2) A false E33180 from typeflow `specializeCall`'s "escaped IRSpecialize" branch is pre-existing on master. It fires when one dynamic value reaches a generic function both directly (`count(v)`) and through another generic (`outer(v)` → `count(u)`). The direct site's set specialization gets materialized and replaces the FuncSet element that the generic caller's site sees. Repro: plain `uint count<T:IValue>(T t)`.
3) In slang-test SIMPLE HLSL output, `CHECK-NEXT` fails across blank and `#line` lines. Use `CHECK-NOT: }` followed by a plain `CHECK:` to stay inside one function body.
4) Renaming a DIAGNOSTIC_TEST prefix (e.g. `//MERGED:` → `//SHARED_TYPE:`) shifts the caret columns. Adjust the padding by the length difference.
