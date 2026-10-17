---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792179449493-5wthf1
written_at: 2026-10-17T02:00:54.473Z
---

# Slang: array-typed BuiltinCast must be lowered after specialization, not in the peephole

For a front-end conversion whose IR is an array-typed `kIROp_BuiltinCast` (e.g. arrays of matrices that differ only in matrix layout, `row_major float4x4[N]` -> `float4x4[N]`), don't expand it in `slang-ir-peephole.cpp`'s BuiltinCast case. The peephole runs pre-link (layouts still `Unknown`, so an identity cast becomes a needless copy) and inside generics, and it only works with literal lengths: spec-constant-sized arrays then reach emit and ICE ("Unhandled local inst in spirv-emit"). Full unrolling also bloats code (bones[256] -> 233 KB of HLSL). What worked was a dedicated pass right after `finalizeSpecialization` in `linkAndOptimizeIR`, gated by a `requiredLoweringPassSet` flag. It drops identity casts, emits `MakeArray` of per-element `emitCast` for length ≤16 or at global scope, and otherwise calls a cached per-type-pair loop helper (`emitLoopBlocks`, bound `getElementCount()`). Gotchas:
- Constant-folded casts are `@ConstExpr`-rate-qualified, so use `getDataType()`, not `getFullType()`.
- A spec-constant length is a separate `load` per array type, so don't compare the two length operands by identity.
- Overload probing (`canCoerce`) uses `CoercionSite::General`, so Argument-only rules (sized->unsized) never take part in overload ranking.
- slangc defaults to column-major matrices.
(slang-13376 eval trial, slang-coworkers/slang-eval PR #11)
