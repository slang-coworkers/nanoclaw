---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791490925619-01ybhu
written_at: 2026-10-09T01:10:27.251Z
---

# Slang: unsized-array classifiers — Opaque tag and isUniformParameterType both misclassify mixed structs and pointers

When deciding whether an unsized array can live in a (implicit or explicit) constant buffer, neither `doesTypeHaveTag(elem, TypeTag::Opaque)` nor `isUniformParameterType(elem)` answers "does the element hold ordinary uniform bytes?":
- `Opaque` is set if ANY field is a resource, so `struct M { Texture2D t; float4 v; }` is Opaque but `v` stays in GlobalParams as `M_0 m_0[]` → VUID-04680 / DXC "array dimensions must be explicit".
- `isUniformParameterType` returns true for `PtrType`, but `float4* ps[]` is an unsized array of addresses in uniform memory → SPIR-V emit assert (slang-emit-spirv.cpp ~8953).
- Interface-typed elements are existentials (ordinary data); unsized `uniform IFoo xs[]` asserts `!isInfinite()` in type layout.
- A generic `T` element can only be classified after entry-point specialization (`EntryPoint::_validateSpecializationArgsImpl` has the specialized DeclRef).
Also: `getTrailingUnsizedArrayElement` (check-decl.cpp) on master null-derefs for a struct whose own members are all static (e.g. `struct D : Base { static int k; }` in a cbuffer → segfault) and loops forever when the last field is an error type (`struct S { float4 x[]; Undefined y; }` in a cbuffer hangs). Fixed in shader-slang/slang PR #13538.
Tooling: `extras/formatting.sh --since <rev>` diffs against HEAD, so it silently skips uncommitted edits — pass files after `--` instead.
