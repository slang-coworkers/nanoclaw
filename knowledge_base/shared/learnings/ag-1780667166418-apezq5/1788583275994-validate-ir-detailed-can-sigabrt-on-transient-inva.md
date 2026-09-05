---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788582270448-q15zft
written_at: 2026-09-05T04:41:15.994Z
---

# -validate-ir-detailed can SIGABRT on transient invalid-SSA from autodiff finalization (false-positive class)

**Symptom:** `slangc ... -validate-ir-detailed` aborts with SIGABRT/exit134, `E40007 IR validation failed: def must come before use in same block` (message only visible with `-enable-machine-readable-diagnostics`). Plain `-validate-ir` AND normal compilation succeed and emit valid SPIR-V. (Seen on #12914: float3 `lerp` + a live RWStructuredBuffer.)

**Why it happens (mechanism, verified on ToT ~HEAD 961e4e59):**
- `-validate-ir-detailed` (CompilerOptionName::ValidateIRDetailed) validates after EVERY `wrapPass` via `postPassHooks` → `validateIRModule` (source/slang/slang-pass-wrapper.cpp:74-76). Plain `-validate-ir` only fires at ~40 hand-placed `validateIRModuleIfEnabled(...)` checkpoints in slang-emit.cpp. So detailed mode observes mid-pipeline states plain mode never sees.
- The "def must come before use in same block" check (`validateIRInstOperand`, source/slang/slang-ir-validate.cpp:201-217) fires ONLY when inst+operand are direct children of the SAME IRBlock; it's pure linked-list precedence (`seenInsts.contains`). Module/global scope explicitly allows out-of-order (:256-269). Sole relaxation = `canRelaxInstOrderRule` (slang-ir-util.cpp:3170-3174).
- The autodiff pipeline INTENTIONALLY leaves IR transiently SSA-invalid (docs/design/autodiff/ir-overview.md) and repairs it via a later hoist/sort (`_maybeHoistOperand` slang-ir.cpp:8984, `sortBlocksInFunc`). So a hoistable/inlined inst can sit before its operand in the linked list at a pass boundary and be normalized before emit. The IR printer inlines/reorders such insts, so `-dump-ir-after <pass>` can look clean while the raw list the validator walks is not.

**Triage tell:** if plain compile + plain `-validate-ir` are green and only `-validate-ir-detailed` crashes, suspect a TRANSIENT mid-pipeline invalid-SSA false-positive, NOT a codegen bug. Find the failing pass with full `-dump-ir` (last "### AFTER <pass>" printed before the abort = the pass whose output tripped it; #12914 = `finalizeAutoDiffPass`).

**Established fix idiom:** wrap the known-transient step in `disableIRValidationScope()` (helper slang-ir-validate.h:67) — the autodiff code already does exactly this at slang-ir-autodiff-cfg-norm.cpp:764 (around constructSSA) and slang-ir-autodiff-fwd.cpp:2437. Prefer a producer insert-point fix if it's a genuine mis-ordering (mirror PR#12095/#12071, promoteOperandsToTargetType). Independent hardening: an internal validation failure currently escapes as an uncaught `AbortCompilationException` → SIGABRT instead of a clean diagnostic (relates #12387, #8376).
