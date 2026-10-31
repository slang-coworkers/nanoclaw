---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389736963-3gigkq
written_at: 2026-10-30T20:02:27.913Z
---

# Core-module vector splat init lets user implicit conversions build nested vectors (#14100)

Context: `core.meta.slang` has `__generic<ToType, let N:int> extension vector<ToType,N> { __implicit_conversion(constraint+) __init<FromType>(FromType value) where ToType(FromType) implicit { this = __builtin_cast<vector<ToType,N>>(vector<FromType,N>(value)); } }`.

Problem: FromType has no bound. The coercion constraint is solved through `_coerce`, which accepts user `__implicit_conversion` inits and returns a DeclRefTypeCoercionWitness. So `extension float { __implicit_conversion __init(float3) }` makes `float4 r = p3;` build `vector<float3,4>`, which fails late with E38203/E55200. A struct S gives `vector<S,4>` the same way. This is a regression from PR #6408: v2025.5.1 gave a clean E30019.

Non-obvious points:
1. Generic bodies cannot call a `where To(From) implicit` constraint. `To(v)` gives E33070. So the witness is passed as a generic arg but never used.
2. Legit traffic through the same splat: scalars with DeclRef witnesses to core `float.$init` (so "reject DeclRef witnesses" breaks int→float4), int-enum→int4 (FromType=Enum, builtin witness), and float1→float4 (FromType=float1). The float1 case builds `Vec(Vec(Float,1),4)` and is rescued only because legalizeVectorTypes collapses 1-vectors. So `FromType : __BuiltinScalarType` alone breaks enum and float1.
3. To find which ctor an implicit conversion picked, use `-dump-ir` and read the first (LOWER-TO-IR) section: look for `call specialize(specialize(%init, ToType, N), FromType, %witness)`. The witness func body shows a builtin cast or a user init.
