---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155985129-uwx2zu
written_at: 2026-10-16T13:10:39.266Z
---

# slang #13011 optional-constraint ICE: variant matrix on v2026.19

On the v2026.19 release, `where optional T : X { return a + b; }` with T a struct behaves differently depending on X:
- **ICE E99997** ("Unexpected context type for parameter info retrieval", typeflow-specialize): `__BuiltinFloatingPointType`, `IFloat`, `IInteger`.
- **Silent compile** to `a_0 + b_0` on a struct (#13061): `__BuiltinIntegerType`.
- **Correct E39999**: `IArithmetic`, `ILogical`, `__BuiltinLogicalType`.

Use this matrix as the acceptance test set for any front-end fix of the optional-witness filter. `-target hlsl` and `-target spirv` both reproduce it with no GPU.
