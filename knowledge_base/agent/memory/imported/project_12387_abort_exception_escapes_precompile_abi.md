---
name: project_12387_abort_exception_escapes_precompile_abi
description: "slang#12387 — AbortCompilationException/InternalError escapes precompileForTarget through the SLANG_NO_THROW public C ABI. Fixed by draft→ready PR #12552 (Approach A boundary guard), maintainer-APPROVED (tangent-vector), human-gated on merge."
metadata: 
  node_type: memory
  type: project
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# slang#12387 — `AbortCompilationException` escapes `precompileForTarget`'s `SLANG_NO_THROW` ABI

🏁 Near-terminal, human-gated: **PR #12552 non-draft + APPROVED, only a maintainer rebase+merge remains** (auto-closes #12387 via `Fixes #12387`). Fourth artifact of the #12371 family; bot-filed 2026-08-06 out of the #12385 chain.

## The defect — two triggers, one ABI hole

An exception escapes `Module::precompileForTarget` through the `SLANG_NO_THROW` public C ABI (the macro is `__declspec(nothrow)` only under Windows + exceptions enabled). Two demonstrated triggers, **not** a universal quantifier over all `Severity >= Fatal` sites:

1. **SPIRV-validation failure** (`SLANG_RUN_SPIRV_VALIDATION=1`): `shouldRunSPIRVValidation` (`slang-emit.cpp:3264`) reads the same option-set `precompileForTarget` populates → `diagnose(SpirvValidationFailed)` (`:3449`) → severity `Internal` (highest, satisfies `>= Fatal`) → `SLANG_ABORT_COMPILATION` → `throw AbortCompilationException`. No frame between the throw and the ABI catches anything (`catch (` count = 0 across the emit/codegen path).
2. **Nested `ParameterBlock<MaterialSystem>` inside `ParameterBlock<Scene>`** (env var UNSET): `SLANG_UNIMPLEMENTED_X` at `slang-emit-spirv.cpp:3017` during *emission*, **before** validation is consulted, throws `Slang::InternalError`. ⇒ **Fixing the #12385 trigger leaves the defect standing**; this trigger survives it and is the one the regression test uses.

Neither `AbortCompilationException` nor `InternalError` derives from `std::exception`, so a host `catch (...)` is the only (unportable) caller-side workaround; `skipSPIRVValidation` does not rescue trigger 2.

## Fix — Approach A, in PR #12552 (APPROVED, human-gated)

Maintainer `tangent-vector` (Tim Foley, Slang lead) authorized the PR 2026-08-06: *"apply the idiom already in use elsewhere on the public API boundary."* **PR #12552** (`fix/issue-12387`, `Fixes #12387`, `pr: non-breaking`): (1) three-arm boundary guard in `slang-compiler-tu.cpp` mirroring `ComponentType::link` (`AbortCompilationException` / `Exception` / `...` → `outputExceptionDiagnostic` + `SLANG_FAIL`, populating `outDiagnostics` in **every** arm — the CLI's arm only diagnoses `if (errorCount==0)`); (2) comment-only fix of the dead-return comment (severity **not** changed); (3) new no-GPU `unit-test-precompile-exception-boundary.cpp` using the nested-`ParameterBlock` trigger. Maintainer APPROVED (review 4941844655, tangent-vector) + a 2nd approve; non-draft; `report_pr_created` mapping verified (`shader-slang/slang 12552 → ag-…-vmjrwe`). slang-reviewer 3-reviewer pipeline = APPROVE_WITH_NITS (non-blocking); fixer correctly did **not** push a nit-fix commit (would move the head off the approved SHA). Triager holds the merge co-trigger (re-read diff → refresh verdict cmt 5202431980 on merge).

**Candidate fixes (maintainer's call):** A (rec) boundary guard — fixes both triggers + any future one, no severity change. B reclassify `spirv-validation-failed` `internal`→`err` — fixes one diagnostic, leaves trigger 2, changes public behaviour. C both. **D rejected** (route through the guarded accessor — semantics differ, breaks entry-point-less modules).

## Durable findings the issue body lacked (verified at `9eb90c50a`)

- ⛔ **The `return SLANG_FAIL` at `slang-emit.cpp:3450` is DEAD CODE and its comment claims the opposite.** `spirv-validation-failed` is `internal(...)` ⇒ `Severity::Internal` ⇒ `diagnose()` aborts before the return. Its sibling `SpirvValidationUnavailable` is `err(...)` ⇒ `Error` ⇒ its identical return IS live. ⇒ a maintainer's second candidate fix (B) is reclassifying `internal`→`err`. Mechanism: [[feedback_a_return_after_diagnose_is_dead_if_the_severity_aborts]].
- **Catch-site census = 15, not 13** (`grep -rn` over `source/`): 8 convert + 5 rethrow + **2 self-guard inside `outputExceptionDiagnostic` itself** — i.e. the suggested fix helper is already hardened against the same defect (strengthens A). Split convert-from-rethrow per [[feedback_a_catch_site_census_must_split_convert_from_rethrow]]; the whole-program accessor `getOrCreateWholeProgramResult` is guarded one frame up by its facade (`getTargetArtifact` :685) → A is the established pattern at 6 boundaries in `source/slang/`, not 5.
- **`getPrecompiledTargetCode` is clean** (the body's open "worth checking" — answer: no): both overloads are pure IR-walk + blob copy, no `diagnose()`. `ComponentType::precompileForTarget` is an unconditional `SLANG_FAIL` stub — the defect is `Module::`-only.

## Method lessons (issue-specific)

- ⭐ **Rescue a stale-instrument hold by probing the instrument for the property you need, not asserting freshness from a timestamp.** My generated-diagnostics tree predated `9cd92bb3a`, so I source-verified only; the triager established `libslang.so` **behaviourally** (must-hit + must-miss controls, dynamic type via `abi::__cxa_current_exception_type()`) and published the exact scope ("source at `9eb90c50a`; binary behaviourally postdates `9cd92bb3a`").
- ⛔ **`grep -rl` counts FILES; a clause census needs `grep -rn`.** A handed-over `-l` discriminator produced a wrong per-directory split (the "plus 6 more" was the file-vs-clause delta); headline totals were right by luck. See [[feedback_a_reconciling_instrument_must_report_the_censused_unit]] and [[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]] (name the directory, not just the predicate).
- Footprint census is stale on arrival under a shared bot identity — re-query before asserting ([[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]]). A persistently-failing a2a route whose target session is provably `active` is a durable nanoclaw routing defect (a dead **edge**, not a dead session), no content lost — relay-fallback through Main.

Family: [[project_12371_spirv_prelink_validation_buffer]] (parent),
[[project_12385_precompile_validation_gate]] + [[project_12385_spirv_validation_precompile_overfire]]
(the trigger; its leaves already flag this ABI hole as a separate defect),
[[project_12383_spirv_validation_before_spvopt_strip]] (sibling).
