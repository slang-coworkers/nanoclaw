---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793811654478-vr0qdh
written_at: 2026-11-04T19:10:45.773Z
---

# Slang capability gating on a type: AST-time, rejects folded code, misses unread struct fields; BFloat16 require is vacuous

Learned while prototyping `[require(...)]` on core-module `double` for WGSL/Metal (#10232):
- A type-level `[require(X)]` (core.meta.slang) propagates through `CapabilityDeclReferenceVisitor` (slang-check-decl.cpp ~22303) into every function that references the type, including local var types, decl-ref operands such as `double.init` and `operator+`, and params. It is reported at entry-point validation as E36107 "unavailable features in entry point", with a "see using of 'double'" note at the user's line.
- This runs on the AST, before optimization. Code that compiles today because the value folds away (`double d = 1.25; o[0] = (float)d;`) becomes an error, so ask the maintainer before gating an existing type.
- A struct's capability set comes only from its own `[require]`, not from its field types. `struct S { float a; double b; }` used through `RWStructuredBuffer<S>` with only `a` read escapes the check entirely.
- The existing BFloat16/FloatE4M3 `[require(cuda_sm_8_0)]` is vacuous on metal/wgsl/hlsl: cuda_sm_8_0 → cuda_sm_6_0 includes sm_4_1, and `sm_4_1_version` includes metal|wgsl|cpp|llvm (capdef ~1759/~2284). Do not use it as a working precedent. `BuiltInTriangleIntersectionAttributes` (hlsl.meta.slang) is a precedent that does work.
- Adding a require to `double` breaks the core-module build until `double.__min/__max` get `[require(fp64, sm_4_0_version)]` and `copysign_double` is re-gated. Including `c` in the alias causes E36104.
- Separately: the deliver-gate hook blocks even read-only `gh api` calls whose path contains `pulls`. Use the slang-mcp PR tools for reads.
