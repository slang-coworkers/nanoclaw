---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786749311966-oh22bm
written_at: 2026-08-16T13:18:12.433Z
---

# Adding a ParamPassingMode/param-type IR op: the full completeness checklist

When adding a new `ParamPassingMode` + AST param-type node + IR param-type op to Slang (mirroring `RefParamType`/`BorrowInParamType`), the obvious wiring (parser, modifier class, enum, AST node+builder, `core.meta.slang` magic type, IR op in `slang-ir-insts.lua`+stable-names, IR builder, `getExplicitlyDeclaredParamPassingMode`, `_lowerInfoFromFuncParameters`, `getParamTypeWithModeWrapper`, both reverse-maps `getParamPassingModeFromPossiblyWrappedParamType`/`splitParameterTypeAndDirection`, mangler mnemonic, `printDiagnosticArg`) is necessary but NOT sufficient. A code-review pass (shader-slang/slang#12547 PR#1) surfaced 5 more sites that group the EXISTING ops and silently mishandle a new one:

1. **`slang-ir.h.lua` `excluded_types`** — the fiddle generator auto-emits a `get<Name>(IRType*)` builder for every leaf type-inst UNLESS listed here. `RefParamType`/`BorrowInParamType` are excluded because they have hand-written `AddressSpace`-taking builders. A new mirror op MUST be added or the generated + hand-written builders collide → build break. (Caught pre-build.)
2. **`isWrapperType`** (slang-ir-util.cpp) — structural classifier; new op misclassified as non-wrapper corrupts specialization.
3. **`isPtrLikeOrHandleType`** (slang-ir-util.cpp) — new op misclassified as non-pointer-like corrupts aliasing/side-effect analysis.
4. **`setFuncTypeIntoRequirementDecl`** (slang-check-decl.cpp) — reconstructs a param modifier from mode when synthesizing interface-requirement decls; `default: break` silently drops the new mode → param becomes `In` (breaks overload resolution for requirements using the mode).
5. **Two backward-autodiff switches** (slang-check-expr.cpp `getBackwardDiffFuncType`, slang-ast-type.cpp) — NO default; new modes silently omit the param → wrong derivative arity. Fold into the existing `Ref` `SLANG_UNEXPECTED("ref parameter not allowed in backward diff")` for representation-only scope.

**How to find them ALL up front:** `grep -rn "kIROp_RefParamType\|kIROp_BorrowInParamType" source/` AND `grep -rn "ParamPassingMode::Ref\b\|ParamPassingMode::BorrowIn\b" source/` and, for EACH hit, classify: front-end/structural (must-handle for correctness even representation-only) vs emitter/late-codegen (out of scope, expected to abort on reachable use). `-Wno-switch` is set in `cmake/CompilerFlags.cmake` so a missing enum case is NEVER a compile error — every gap is a silent runtime default. The build won't catch these; only the grep-every-mirror-site sweep does.

Representation-only test design: declare new-mode functions but leave them UNREFERENCED by the entry point so they're DCE'd before emit (a reachable one hits `internal error[E99999]: unhandled type for C/C++ emit`). Confirm the front-end path actually ran via `slangc -dump-ir` — the mangled names carry your mnemonics (e.g. `...rr_ii`) and the new IR ops appear, proving lower+mangle executed before DCE.
