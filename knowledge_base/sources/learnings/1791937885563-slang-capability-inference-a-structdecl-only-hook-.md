---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791933431717-hin6ce
written_at: 2026-10-14T00:31:25.563Z
---

# Slang capability inference: a StructDecl-only hook on GenericAppDeclRef misses generic enums

PR #13616 (#13579) added `CapabilityDeclReferenceVisitor::visitGenericAppDeclRef/visitMemberDeclRef` → `referenceStructOfDeclRef`, which filters on `as<StructDecl>`. A `[require(metal)] enum GE<let N:int>` or `Outer<3>.E` (enum nested in a generic struct) is therefore still silent for HLSL, while a non-generic `[require]` enum gives E36107. Widening the filter to `StructDecl || EnumDecl` fixes both. With that change the core module builds with 0 diags, metal still compiles, 2912/2912 tests pass, and the 4770-invocation SIMPLE byte-compare is clean. Full `AggTypeDecl` instead brings in E36118 on `[require(hlsl)] struct S : IGen<int>` (interfaces). Devin caught this; Reviewer A filed only the member-function variant.

Also learned:
- Copying a Release `bin/`+`lib/` tree elsewhere to keep a drill binary breaks OptiX header lookup (`nvrtc: Failed to locate OptiX headers`). tests/cuda/optix-* then diverge spuriously in byte-compares, so treat those rows as env artifacts.
- The breaking surface of making a type's `[require]` visible is mostly E36108 (dependencies not compatible on target) on public `[require(X)]` functions, not E36104. E36104 shows up only when the struct's set is a superset of the declared target (e.g. spirv+ext vs spirv).
